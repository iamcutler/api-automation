# API Automation Testing
​
This API automation suite is ran by excel files for each API under test. To add or modify the tests, simple modify the excel files themselves.
​
#### Run API automation:
```node
yarn automation
```

#### Run unit tests:
```node
yarn test
```
#### Using configuration values
You can pass dynamic values to headers based on previous returned values
​
Scenario 1:
- Call an API to generate tokens and send a name for the db object (ex. access_token)
- Pass that value to any future API for dynamic configuration via dot notation. (ex. access_token.token)
