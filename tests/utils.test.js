const assert = require('assert');
const fs = require('fs');
const apiUtils = require('../utils');
const sinon = require('sinon');
const xlsx = require('xlsx');
const child_process = require('child_process');
const sandbox = sinon.createSandbox();

describe('Utils', () => {
    beforeEach(() => {
        sandbox.stub(fs, 'readFile');
        sandbox.stub(child_process, 'exec');
    });

    afterEach(() => {
        sandbox.restore();
    });

    const configuration = {
        tokens: [{
            access_token: '345645567756567567657567',
        }],
    };

    describe('method: setHeaders', () => {
        const configuration = {};

        it('should set the Content-Type header if present', () => {
            // given
            const api = {
                headers: `
                    content-type=application/json,
                    username=services
                `,
            };
            // when
            const result = apiUtils.setHeaders(api, configuration);
            // then
            assert.equal(result['content-type'], 'application/json');
        });

        it('should set the X-Access-Token header if present', () => {
            // given
            const api = {
                headers: `
                    content-type=application/json,
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
            const result = apiUtils.getConfigValueFromSheet('db.tokens.0.access_token', configuration);
            // then
            assert.equal(result, configuration.tokens[0].access_token);
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
            const schemaName = 'testing';
            // when
            apiUtils.validateAPIResponse(schemaName, response)
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
            const schemaName = 'testing';
            // when
            apiUtils.validateAPIResponse(schemaName, response)
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
        // given
        const payload = {
            "user_id": "db.user.id",
            "timestamp": 1460043522252,
            "type": "test",
            "test": "db.user.name"
        };
        const configuration = {
            user: {
                id: '345765675678678',
                name: 'John Doe'
            },
        };

        it('should return json data from a payload file with single level dynamic values', (done) => {
            // given
            fs.readFile.yields(null, {
                toString: () => JSON.stringify(payload),
            });
            // when
            apiUtils.getJSONPayloadData(configuration, payload)
                .then((result) => {
                    // then
                    assert.deepEqual(result, {
                        "user_id": configuration.user.id,
                        "timestamp": payload.timestamp,
                        "type": payload.type,
                        "test": configuration.user.name
                    });
                    done();
                });
        });

        it('should return json data from a payload file with multiple level(s) dynamic values', (done) => {
            // given
            const payload2 = Object.assign({}, payload, {
                "test": {
                    "name": "db.user.name",
                },
            });
            fs.readFile.yields(null, {
                toString: () => JSON.stringify(payload2),
            });
            // when
            apiUtils.getJSONPayloadData(configuration, payload2)
                .then((result) => {
                    // then
                    assert.deepEqual(result, {
                        "user_id": configuration.user.id,
                        "timestamp": payload.timestamp,
                        "type": payload.type,
                        "test": {
                            "name": configuration.user.name,
                        },
                    });
                    done();
                });
        });

        it('should reject if an error occurred', (done) => {
            // given
            const error = new Error('No such file or directory');
            fs.readFile.yields(error);
            // when
            apiUtils.getJSONPayloadData()
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

    describe('method: restoreTestData', () => {
        it('should execute the expected command', () => {
            // given
            // when
            apiUtils.restoreTestData();
            // then
            assert(child_process.exec.calledWith('yarn restore_test_data'));
        });

        it('should reject if an error occurred', (done) => {
            // given
            const error = new Error('Something went wrong');
            child_process.exec.yields(error);
            // when
            apiUtils.restoreTestData()
                .catch((err) => {
                    assert.equal(err.message, error.message);
                    done();
                });
        });
    });

    describe('method: constructRequestUrl', () => {
        it('should inject dynamic config into a URL', () => {
            // given
            const config = {
                server_url: 'http://localhost:4000',
                user: {
                    id: '4565676784353456567',
                },
            };
            const url = '/api/v1/test/{db.user.id}';
            // when
            const result = apiUtils.constructRequestUrl(url, config);
            // then
            assert.equal(result, `${config.server_url}/api/v1/test/${config.user.id}`);
        });

        it('should inject dynamic config into a URL with multiple dynamic values', () => {
            // given
            const config = {
                server_url: 'http://localhost:4000',
                user: {
                    id: '4565676784353456567',
                },
                user2: {
                    id: '34557667867823434232',
                },
            };
            const url = '/api/v1/test/{db.user.id}/{db.user2.id}';
            // when
            const result = apiUtils.constructRequestUrl(url, config);
            // then
            assert.equal(result, `${config.server_url}/api/v1/test/${config.user.id}/${config.user2.id}`);
        });

        it('should pass back non-dynamic URL', () => {
            // given
            const config = {
                server_url: 'http://localhost:4000',
            };
            const url = '/api/v1/test';
            // when
            const result = apiUtils.constructRequestUrl(url, config);
            // then
            assert.equal(result, `${config.server_url}${url}`);
        });
    });
});
