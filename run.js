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
    it.each(xlsx.utils.sheet_to_json(worksheet), '%s: %s', ['url', 'description'], async (api, done) => {
        let payload = null;
        const targetURL = `${configuration.server_url}${api.url}`;

        try {
            // add payload data if present
            if (api.payload) {
                payload = await apiUtils.getJSONPayloadData(api.payload);
            }
        }
        catch(err) {
            return done(err);
        }

        // call the API
        request({
            uri: targetURL,
            method: api.method,
            headers: apiUtils.setHeaders(api, configuration),
            json: payload,
        }, async (err, response, body) => {
            try {
                if (err) return done(err);
                let responseBody;

                try {
                    responseBody = JSON.parse(body);
                }
                catch (e) {
                    responseBody = body;
                }

                // save dynamic configuration values if present
                if (api.save_to_db) {
                    configuration[api.save_to_db] = 'data' in responseBody ? responseBody.data : responseBody;
                }

                // content type
                assert.equal(api.response_content_type, response.headers['content-type'], `Content-type must match the returned content-type. Expected: ${api.response_content_type}, Actual: ${response.headers['content-type']}`);
                // status code
                assert.equal(response.statusCode, Number(api.response_status_code), `${targetURL} status code doesn't match. Expected: ${api.response_status_code}, Actual: ${response.statusCode}`);
                // response validation
                if (api.response_data) {
                    const validateResponse = await apiUtils.validateAPIResponse(`${__dirname}/schemas/${api.response_data}.json`, responseBody.data);

                    assert.deepEqual(validateResponse, [], 'API response should match expected schema');
                }

                done();
            }
            catch (err) {
                done(err);
            }
        });
    });
}
