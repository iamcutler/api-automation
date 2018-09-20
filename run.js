require('it-each')({ testPerIteration: true });

const assert = require('assert');
const fs = require('fs');
const xlsx = require('xlsx');
const request = require('request');
const apiUtils = require('./utils');

describe('API Automation Testing', () => {
    // read the workbook for automated api scenarios
    const workbook = xlsx.read(fs.readFileSync('api-automation.xlsx'), {type: 'buffer'});
    // get the server API scenarios
    const worksheet = workbook.Sheets['apis'];
    // look at the configuration sheet
    const configuration = apiUtils.getConfigurationFromSheet(workbook.Sheets['configuration']);

    generateAPISpecs(worksheet, configuration);
});

/**
 * Generate the automated specs for a given API
 * @param {Object} worksheet
 * @param {Object} configuration
 */
function generateAPISpecs (worksheet, configuration) {
    it.each(xlsx.utils.sheet_to_json(worksheet), '%s: %s', ['url', 'description'], async function(api, done) {
        let payload = null;

        try {
            // set additional time if delay is provided
            if (api.delay) {
                this.timeout(2000 + Number(api.delay));
            }
            // restore test data before automation run
            if (api.restore_db === 'TRUE') {
                this.timeout(10000); // set async spec timeout

                console.log(`Restoring test data before: ${api.url}`);
                await apiUtils.restoreTestData();
            }

            // add payload data if present
            if (api.payload) {
                payload = await apiUtils.getJSONPayloadData(configuration, api.payload);
            }
        }
        catch(err) {
            return done(err);
        }

        // call the API
        const apiResponse = await apiUtils.makeAPIRequest({
            uri: apiUtils.constructRequestUrl(api.url, configuration),
            method: api.method,
            headers: apiUtils.setHeaders(api, configuration),
            json: payload,
        }, {
            delay: api.delay || 0,
        });

        try {
            let responseBody;

            try {
                responseBody = JSON.parse(apiResponse.body);
            }
            catch (e) {
                responseBody = apiResponse.body;
            }

            // save dynamic configuration values if present
            if (api.save_to_db) {
                configuration[api.save_to_db] = 'data' in responseBody ? responseBody.data : responseBody;
            }

            // content type
            assert.equal(api.response_content_type, apiResponse.response.headers['content-type'], `Content-type must match the returned content-type. Expected: ${api.response_content_type}, Actual: ${apiResponse.response.headers['content-type']}`);
            // status code
            assert.equal(apiResponse.response.statusCode, Number(api.response_status_code), `${api.url} status code doesn't match. Expected: ${api.response_status_code}, Actual: ${apiResponse.response.statusCode}`);
            // response message
            if (api.response_message) assert.equal(responseBody.message, api.response_message);
            // response validation
            if (api.response_data) {
                const validateResponse = await apiUtils.validateAPIResponse(api.response_data, responseBody.data);

                assert.deepEqual(validateResponse, [], 'API response should match expected schema');
            }

            done();
        }
        catch (err) {
            done(err);
        }
    });
}
