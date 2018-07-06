const assert = require('assert');
const fs = require('fs');
const apiUtils = require('../utils');
const sinon = require('sinon');
const xlsx = require('xlsx');
const sandbox = sinon.createSandbox();

describe('Utils', () => {
    beforeEach(() => {
        sandbox.stub(fs, 'readFile');
    });

    afterEach(() => {
        sandbox.restore();
    });

    const configuration = {
        patient_tokens: [{
            access_token: '345645567756567567657567',
        }],
    };

    describe('method: setHeaders', () => {
        const configuration = {};

        it('should set the Content-Type header if present', () => {
            // given
            const api = {
                headers: `
                    content_type=application/json,
                    username=services
                `,
            };
            // when
            const result = apiUtils.setHeaders(api, configuration);
            // then
            assert.equal(result['content-type'], api.header_content_type);
        });

        it('should set the X-Access-Token header if present', () => {
            // given
            const api = {
                headers: `
                    content_type=application/json,
                    username=services,
                    x-access-token=5467567865586876587567
                `,
            };
            // when
            const result = apiUtils.setHeaders(api, configuration);
            // then
            assert.equal(result['x-access-token'], '5467567865586876587567');
        });
    });

    describe('method: getConfigValueFromSheet', () => {
        it('should return a configuration value if found in value string', () => {
            // given
            // when
            const result = apiUtils.getConfigValueFromSheet('db.patient_tokens.0.access_token', configuration);
            // then
            assert.equal(result, configuration.patient_tokens[0].access_token);
        });
    });

    describe('method: validateAPIResponse', () => {
        it('should return an empty errors array if validate passes', (done) => {
            // given
            fs.readFile.yields(null, JSON.stringify({
                "type": "object",
                "$schema": "http://json-schema.org/draft-04/schema#",
                "id": "update",
                "properties": {
                    "test": {
                        "type": "object",
                        "properties": {
                            "testing" : {
                                "type" : "string",
                                "required": true
                            },
                            "additionalProperties": false
                        }
                    }
                }
            }));
            const response = {
                test: {
                    testing: 'Hello World'
                }
            };
            // when
            apiUtils.validateAPIResponse('/schemas/testing.json', response)
                .then((result) => {
                    // then
                    assert.deepEqual(result, []);
                    done();
                });
        });

        it('should return an errors array if validation fails', (done) => {
            // given
            fs.readFile.yields(null, JSON.stringify({
                "type": "object",
                "$schema": "http://json-schema.org/draft-04/schema#",
                "id": "update",
                "properties": {
                    "test": {
                        "type": "object",
                        "properties": {
                            "testing" : {
                                "type" : "string",
                                "required": true
                            },
                            "additionalProperties": false
                        }
                    }
                }
            }));
            const response = {
                test: {}
            };
            // when
            apiUtils.validateAPIResponse('/schemas/testing.json', response)
                .then((result) => {
                    // then
                    assert.deepEqual(result, [{ field: 'data.test.testing',
                        message: 'is required',
                        value: undefined,
                        type: 'string',
                        schemaPath: [ 'properties', 'test', 'properties', 'testing' ]
                    }]);
                    done();
                });
        });
    });

    describe('method: getJSONPayloadData', () => {
        it('should return json data from a payload file', (done) => {
            // given
            const payload = {
                test: 'Hello World',
            };
            fs.readFile.yields(null, {
                toString: () => JSON.stringify(payload),
            });
            // when
            apiUtils.getJSONPayloadData('test_data')
                .then((result) => {
                    // then
                    assert.deepEqual(result, payload);
                    done();
                });
        });

        it('should reject if an error occurred', (done) => {
            // given
            const error = new Error('No such file or directory');
            fs.readFile.yields(error);
            // when
            apiUtils.getJSONPayloadData('test_data')
                .catch((err) => {
                    // then
                    assert.equal(err.message, error.message);
                    done();
                });
        });
    });

    describe('method: getConfigurationFromSheet', () => {
        beforeEach(() => {
            sandbox.stub(xlsx.utils, 'sheet_to_json');
        });

        it('should call the xlsx sheet to json with the expected params', () => {
            // given
            const sheet = 'configuration';
            xlsx.utils.sheet_to_json.returns([]);
            // when
            apiUtils.getConfigurationFromSheet(sheet);
            // then
            assert(xlsx.utils.sheet_to_json.calledWithExactly(sheet, {
                raw: true,
                header: 1,
            }));
        });

        it('should reduce the multidimensional array to an map', () => {
            // given
            const sheet = 'configuration';
            xlsx.utils.sheet_to_json.returns([
                ['server_url', 'http://localhost:4000'],
                ['test', 'testing'],
            ]);
            // when
            const result = apiUtils.getConfigurationFromSheet(sheet);
            // then
            assert.deepEqual(result, {
                server_url: 'http://localhost:4000',
                test: 'testing',
            });
        });
    });
});
