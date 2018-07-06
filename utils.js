const fs = require('fs');
const Promise = require('bluebird');
const jsonValidator = require('is-my-json-valid');
const xlsx = require('xlsx');

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
            if (i === 0) return configuration[val];
            return acc[val];
        }, null);
    },

    /**
     * Get payload data from payload file(s)
     * @param {string} payloadPath
     */
    getJSONPayloadData(payload) {
        const readFile = Promise.promisify(fs.readFile);

        return readFile(`${__dirname}/payloads/${payload}.json`)
            .then((content) => content.toString())
            .then((payload) => JSON.parse(payload));
    },

    /**
     * Validate the API response against the expected schema
     * @param {Object} schemaPath
     * @param {Object} response
     * @returns {Promise}
     */
    validateAPIResponse(schemaPath, response) {
        const readFile = Promise.promisify(fs.readFile);

        return readFile(schemaPath)
            .then((content) => {
                const validate = jsonValidator(content.toString(), {verbose: true, greedy: true});

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
};
