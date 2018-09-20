const fs = require('fs');
const Promise = require('bluebird');
const jsonValidator = require('is-my-json-valid');
const request = require('request');
const xlsx = require('xlsx');
const child_process = require('child_process');

module.exports = {
    /**
     * Set spec headers
     * @param {Object} api
     * @param {Object} configuration
     * @returns {Object}
     */
    setHeaders(api, configuration) {
        return api.headers.split(',').reduce((acc, val) => {
            const pair = val.split('=');

            // find config values
            if (/^db\./.test(pair[1])) {
                acc[pair[0].trim()] = this.getConfigValueFromSheet(pair[1], configuration);
            }
            else {
                acc[pair[0].trim()] = pair[1].trim();
            }

            return acc;
        }, {});
    },

    /**
     * Get a configuration value passed from the spec sheet
     * @param {string} value
     * @returns {*}
     */
    getConfigValueFromSheet(value, configuration) {
        return value.replace(/^db\./, '').split('.').reduce((acc, val, i) => {
            if (i === 0 && configuration[val]) return configuration[val];
            return acc[val];
        }, null);
    },

    /**
     * Get payload data from payload file(s)
     * @param {object} configuration - stored values in memory
     * @param {string} payload
     */
    getJSONPayloadData(configuration, payload) {
        const readFile = Promise.promisify(fs.readFile);

        return readFile(`${__dirname}/payloads/${payload}.json`)
            .then((content) => content.toString())
            .then((content) => {
                const searchDynamicValues = content.match(RegExp('"db\\.(.*?)"','g')) || [];

                searchDynamicValues.forEach((v) => {
                    const dynamicValue = v.replace(/^"db./, '').replace(/"$/, '').split('.').reduce((acc, val, i) => {
                        if (i === 0 && configuration[val]) return configuration[val];
                        return acc[val];
                    }, null);

                    content = content.replace(new RegExp(v, 'g'), `"${dynamicValue}"`);
                });

                return JSON.parse(content);
            });
    },

    /**
     * Validate the API response against the expected schema
     * @param {string} schemaName
     * @param {Object} response
     * @returns {Promise}
     */
    validateAPIResponse(schemaName, response) {
        const readFile = Promise.promisify(fs.readFile);

        return readFile(`${__dirname}/schemas/${schemaName}.json`)
            .then((content) => {
                const validate = jsonValidator(JSON.parse(content.toString()), {
                    verbose: true,
                    greedy: true,
                });

                validate(response);

                return validate.errors || [];
            });
    },

    /**
     * Map configuration multidimensional array to an map
     * @param {string} sheet
     * @returns {Object}
     */
    getConfigurationFromSheet(sheet) {
        return xlsx.utils.sheet_to_json(sheet, {
            raw: true,
            header: 1,
        }).reduce((acc, val) => {
            acc[val[0]] = val[1];
            return acc;
        }, {})
    },

    /**
     * Restore the test data set
     */
    restoreTestData() {
        return new Promise((resolve, reject) => {
            child_process.exec('yarn restore_test_data', (err, stdout) => {
                if (err) return reject(err);

                resolve(stdout);
            });
        });
    },

    /**
     * Make request to a desired API
     * @param {Object} options
     * @param {Object} config
     * @param {number} config.delay - delay the request by ms
     */
    makeAPIRequest(options = {}, config = { delay: 0 }) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                request(options, (err, response, body) => {
                    if (err) return reject(err);

                    resolve({response, body});
                });
            }, config.delay);
        });
    },

    /**
     * Construct API reuqest URL
     * @param {string} url
     * @param {Object} config
     * @returns {string}
     */
    constructRequestUrl(url, config) {
        // get all matches for dynamic values
        return `${config.server_url}${url.replace(/\{db\.(.+?)\}/g, (match, offset) => {
            // return config based on offset matches
            return offset.split('.').reduce((acc, i) => acc[i], config);
        })}`
    },
};
