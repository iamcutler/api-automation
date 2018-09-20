const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const apiUtils = require('../utils');
const api_excels = ['api-automation'];
const outpathPath = path.resolve(__dirname, '../xlsx_diff.json');

try {
    const diff = api_excels.reduce((acc, excel) => {
        // create high level object from excel name to track
        acc[excel] = {};
        // read the desired workbook
        const workbook = xlsx.read(fs.readFileSync(`${excel}.xlsx`), {type: 'buffer'});
        // iterate sheets and assign keys
        workbook.SheetNames.forEach((sheet) => {
            // fetch sheet from workbook
            const worksheet = workbook.Sheets[sheet];

            if (sheet === 'configuration') {
                acc[excel][sheet] = apiUtils.getConfigurationFromSheet(worksheet);
            }
            else {
                acc[excel][sheet] = xlsx.utils.sheet_to_json(worksheet);
            }
        });

        return acc;
    }, {});

    // read the output file
    fs.writeFileSync(outpathPath, JSON.stringify(diff, 0, 2));
    console.info(`Excel diff file updated/created at ${outpathPath}`);
}
catch (err) {
    throw err;
}
