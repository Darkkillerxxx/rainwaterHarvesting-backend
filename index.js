import "dotenv/config"
import express, { response } from 'express';
import bodyParser from 'body-parser';
import { queryData } from './dbconfig.js';
import cors from 'cors';
import Crypto from "crypto-js";
import jwt from "jsonwebtoken";
import Client from 'ftp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Console } from "console";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ftpClient = new Client();

const jwtSecret = process.env.JWTSECRET;
let key = Crypto.enc.Base64.parse(process?.env?.AESSECRET);
let iv = Crypto.enc.Hex.parse("00000000000000000000000000000000");


var jsonParser = bodyParser.json()
const app = express();

app.use(cors());

app.use(express.json({ limit: '50mb' }));

async function getSliderImages() {
    const client = new Client();

    return new Promise((resolve, reject) => {
        client.on('ready', () => {
            // Change directory to the 'slider' folder
            client.list('/Sliders', (err, list) => {
                if (err) {
                    console.error('Error fetching files:', err);
                    return;
                }
                //  console.log('Files in slider folder:', list);
                resolve(list);


                // End the connection
                client.end();
            });
        });

        // Connect to the FTP server
        client.connect({
            host: 'ftp.jalshakti.co.in',
            user: 'u428611290.jalshakti',
            password: 'Jalshakti@2024'
        });
    });
}

function uploadImageToFTP(imagePath, imageName, folderName) {
    return new Promise((resolve, reject) => {
        const client = new Client();

        client.on('ready', () => {
            console.log('FTP connection ready');

            client.cwd(`/${folderName}`, (err) => {
                if (err) {
                    client.end();
                    return reject(`Error changing directory: ${err.message}`);
                }
            })

            client.put(imagePath, imageName, (err) => {
                if (err) {
                    console.error('Error uploading file:', err);
                    reject('Error uploading file: ' + err);
                } else {
                    console.log('File uploaded successfully');

                    // Construct the public URL
                    const publicUrl = `http://jalshakti.co.in/${folderName}/${imageName}`;
                    console.log('Publicly accessible URL:', publicUrl);

                    resolve(publicUrl);
                }

                // Close the FTP connection
                console.log('Closing the FTP connection');
                client.end();
            });
        });

        client.on('error', (err) => {
            console.error('FTP connection error:', err);
            reject('FTP connection error: ' + err);
        });

        // Connect to FTP server
        client.connect({
            host: 'ftp.jalshakti.co.in',
            user: 'u428611290.jalshakti',
            password: 'Jalshakti@2024'
        });
    });
}

function generateMSSQLInsertQuery(tableName, insertObject) {
    // Get the keys and values from the object
    //console.log(62, insertObject);
    const keys = Object.keys(insertObject);
    const values = Object.values(insertObject);

    // Construct the column names part of the query
    const columns = keys.map((key) => `[${key}]`).join(', ');

    // Construct the values part of the query, adding quotes around strings
    const formattedValues = values
        .map((value) =>
            typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : value
        )
        .join(', ');

    // Construct the final INSERT INTO SQL query
    const query = `INSERT INTO ${tableName} (${columns}) VALUES (${formattedValues})`;

    return query;
}

function generateMSSQLUpdateQuery(tableName, updateObject, conditionObject) {
    // Exclude 'ID' from the updateObject by filtering both keys and values together
    const entries = Object.entries(updateObject).filter(([key]) => key !== 'ID');

    // Construct the SET part of the query
    const setPart = entries
        .map(([key, value]) => {
            // Handle null values
            if (value === null || value === undefined) {
                return `[${key}] = NULL`;
            }

            // Handle date values (assuming they're passed as strings or Date objects)
            if (key.toLowerCase().includes('date') && value instanceof Date) {
                return `[${key}] = '${value.toISOString().split('T')[0]}'`; // Format date as 'YYYY-MM-DD'
            }

            // Escape strings and replace single quotes to avoid SQL injection
            return typeof value === 'string'
                ? `[${key}] = '${value.replace(/'/g, "''")}'`
                : `[${key}] = ${value}`;
        })
        .join(', ');

    // Construct the condition part (WHERE clause) based on the conditionObject (e.g., where ID = X)
    const conditionKeys = Object.keys(conditionObject);
    const conditionValues = Object.values(conditionObject);

    const conditionPart = conditionKeys
        .map((key, index) => {
            const value = conditionValues[index];
            return typeof value === 'string'
                ? `[${key}] = '${value.replace(/'/g, "''")}'`
                : `[${key}] = ${value}`;
        })
        .join(' AND ');

    // Construct the final UPDATE SQL query
    const query = `UPDATE ${tableName} SET ${setPart} WHERE ${conditionPart}`;

    return query;
}




app.get('/getAllLocationForDistricts', async (req, res) => {
    try {
        const { DISTRICT } = req.query;
        const response = await queryData(`SELECT Latitude,longitude,District,Taluka,Village,Location,Inauguration_DATE,COMPLETED_DATE,Inauguration_PHOTO1,COMPLETED_PHOTO1 from Water_Harvesting WHERE DISTRICT='${DISTRICT}' AND Latitude IS NOT NULL AND Longitude IS NOT NULL`);

        res.send({
            code: 200,
            message: 200,
            data: response.recordsets[0]
        })

    }
    catch (error) {
        return {
            code: 500,
            message: error.message
        }
    }
})

app.get('/getAllDistrics', async (req, res) => {
    // const response = await queryData(`select Distinct DISTRICT from Water_Harvesting`);
    const response = await queryData(`select Distinct DISTRICT from V_VILLAGE order by DISTRICT`);
    res.send({
        code: 200,
        message: "Success",
        data: response.recordsets[0]
    })
})

app.get('/getPicklistValues', async (req, res) => {
    try {
        const { District, Taluka } = req.query;

        // Start building the query
        let pickListvaluesQuery = `SELECT DISTINCT DISTRICT, TALUKA, VILLAGE FROM Water_Harvesting`;

        // Add conditions only if District or Taluka are provided
        if (District || Taluka) {
            pickListvaluesQuery += ' WHERE';

            if (District) {
                pickListvaluesQuery += ` DISTRICT = '${District}'`;  // Add District filter
            }

            if (Taluka) {
                // If both District and Taluka are present, add 'AND' between them
                if (District) pickListvaluesQuery += ' AND';
                pickListvaluesQuery += ` TALUKA = '${Taluka}'`;  // Add Taluka filter
            }
        }

        // Other queries remain the same
        const implementationAuthorityQuery = `SELECT * FROM mstImplimantationAuthority`;
        const fundsQuery = `SELECT * FROM mstFunds`;

        const [locationsValues, implementationAuthorityValues, fundsValues] = await Promise.all([
            queryData(pickListvaluesQuery),
            queryData(implementationAuthorityQuery),
            queryData(fundsQuery)
        ]);

        res.send({
            code: 200,
            message: "Success",
            data: locationsValues.recordset,  // Fixing recordsets[0] to recordset
            implementationAuthorityValues: implementationAuthorityValues.recordset,
            fundsValues: fundsValues.recordset
        });
    } catch (error) {
        res.status(500).send({
            code: 500,
            message: error.message
        });
    }
});


app.get('/getDashboardValues', async (req, res) => {
    const { DISTRICT } = req.query;

    // Build base WHERE condition
    let whereClause = DISTRICT ? `WHERE DISTRICT = '${DISTRICT}'` : '';

    // Add AND conditions only if DISTRICT is present
    let inaugurationCondition = DISTRICT ? `AND Inauguration_DATE IS NOT NULL` : `WHERE Inauguration_DATE IS NOT NULL`;
    let completionCondition = DISTRICT ? `AND COMPLETED_DATE IS NOT NULL` : `WHERE COMPLETED_DATE IS NOT NULL`;

    // Updated queries with dynamic conditions
    const talukasCountQuery = `SELECT COUNT(*) as Total_Distinct_Taluka_Count 
                             FROM (SELECT DISTINCT TALUKA FROM Water_Harvesting ${whereClause}) AS DistinctTalukas`;

    const villageCountQuery = `SELECT COUNT(*) as Total_Distinct_Village_Count 
                             FROM (SELECT DISTINCT VILLAGE FROM Water_Harvesting ${whereClause}) AS DistinctVillages`;

    const inaugrationCountQuery = `SELECT COUNT(*) as Total_Inaugration_Count 
                             FROM (SELECT * FROM Water_Harvesting ${whereClause} ${inaugurationCondition}) AS InauguratedProjects`;

    const completionCountQuery = `SELECT COUNT(*) as Total_completion_Count 
                             FROM (SELECT * FROM Water_Harvesting ${whereClause} ${completionCondition}) AS CompletedProjects`;

    const totalTargetQuery = `SELECT COUNT(*) as Total_Target_Records FROM Water_Harvesting ${whereClause}`;

    const getPieChartValue = `SELECT DISTINCT TALUKA, COUNT(*) as count FROM Water_Harvesting ${whereClause} GROUP BY TALUKA`;

    const totalCountQuery = `SELECT COUNT(*) as Total_Records FROM Water_Harvesting`;

    const getStackedBarChartValue = `SELECT TALUKA, GRANT_NAME, COUNT(*) AS count FROM Water_Harvesting ${whereClause} GROUP BY TALUKA, GRANT_NAME`;

    try {
        const [talukasCount, villageCount, inaugrationCount, completionCount, totalTargetCount, pieChart, stackedBarChar, totalCount] = await Promise.all([
            queryData(talukasCountQuery),
            queryData(villageCountQuery),
            queryData(inaugrationCountQuery),
            queryData(completionCountQuery),
            queryData(totalTargetQuery),
            queryData(getPieChartValue),
            queryData(getStackedBarChartValue),
            queryData(totalCountQuery)
        ]);

        const finalResponse = {
            talukasCount: talukasCount.recordset[0].Total_Distinct_Taluka_Count,
            villageCount: villageCount.recordset[0].Total_Distinct_Village_Count,
            inaugrationCount: inaugrationCount.recordset[0].Total_Inaugration_Count,
            completionCount: completionCount.recordset[0].Total_completion_Count,
            totalTargetCount: totalTargetCount.recordset[0].Total_Target_Records,
            totalRecordCount: totalCount.recordset[0].Total_Records,
            pieChart: pieChart.recordset,
            stackedBarChart: stackedBarChar.recordset
        };

        res.send(finalResponse);
    } catch (error) {
        console.error('Error querying database:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/getAllTargets', async (req, res) => {
    const { DISTRICT } = req.query; // Get DISTRICT from query parameter

    if (!DISTRICT) {
        return res.status(400).send({
            code: 400,
            message: "DISTRICT parameter is required"
        });
    }

    try {
        const response = await queryData(`
            SELECT count(*) as District_Wise_Target from Water_Harvesting WHERE DISTRICT = '${DISTRICT}'
        `);

        res.send({
            code: 200,
            message: "Success",
            data: response.recordsets[0]
        });

    } catch (error) {
        res.status(500).send({
            code: 500,
            message: "Internal server error",
            error: error.message
        });
    }
})

const verifyToken = (token, secret) => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, secret, (erclearr, decoded) => {
            if (err) {
                return reject(err);
            }
            resolve(decoded);
        });
    });
};

app.post('/createRecords', jsonParser, async (req, res) => {
    const { body, headers } = req;
    const { Inauguration_PHOTO1 } = body; // Assume the base64 image is passed in this field


    try {

        // Extract the access token from the 'Authorization' header
        // const authToken = headers['authorization'];
        // const token = authToken && authToken.split(' ')[1]; // Assuming the format is 'Bearer <token>'

        //const user = await verifyToken(token,process.env.JWTSECRET);
        // console.log(369,user);
        // Validate if Inauguration_PHOTO1 exists and is a valid base64 string
        if (!Inauguration_PHOTO1 || !Inauguration_PHOTO1.startsWith('data:image/')) {
            return res.status(400).send({
                code: 400,
                message: 'Invalid or missing base64 image data',
            });
        }

        // Generate a random number for the image name
        const randomNumber = Math.floor(Math.random() * 1000000);
        const imageName = `StartWorkPhoto_${randomNumber}.png`;

        // Determine image type (png, jpeg, etc.)
        const matches = Inauguration_PHOTO1.match(/^data:image\/([a-zA-Z]+);base64,/);
        if (!matches || matches.length < 2) {
            return res.status(400).send({
                code: 400,
                message: 'Invalid image format',
            });
        }
        const imageType = matches[1]; // Extract the image type (png, jpeg, etc.)

        // Construct the file name with the correct extension
        const imagePath = `./StartWorkPhoto_${randomNumber}.${imageType}`;

        // Remove any whitespaces or newlines that may corrupt the image
        const base64Data = Inauguration_PHOTO1.replace(/^data:image\/[a-zA-Z]+;base64,/, '').replace(/\s/g, '');

        // Write the decoded base64 data as binary
        fs.writeFileSync(imagePath, base64Data, { encoding: 'base64' });

        // Upload the image to FTP and get the public URL
        const publicUrl = await uploadImageToFTP(imagePath, imageName, 'StartWork');

        // Store the public URL in the request body
        body.Inauguration_PHOTO1 = publicUrl;

        // Delete the local file after FTP upload
        fs.unlinkSync(imagePath);
        body.CRE_USR_DT = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).toISOString();
        // new Date().toISOString();
        // body.CRE_USR_ID = 11;//Remove on 22032025  user.userId;
        // body.CRE_BY_ADMIN =0// user.isAdmin ? 1 : 0;

        // Capitalize all data fields in the body .. updated by SUMIT
        // for (const key in body) {
        //     if (typeof body[key] === 'string') {
        //         body[key] = body[key].toUpperCase();
        //     }
        // }
        //Created by Jagdish
        // Example route with validation
        // Validate and convert numeric fields
        const numericFields = ['Latitude', 'Longitude', 'APPROX_AMOUNT'];
        const data = {};

        for (const field of numericFields) {
            if (req.body[field] === null) {
                data[field] = null;
            } else {
                const num = Number(req.body[field]);
                if (isNaN(num)) {
                    throw new Error(`Invalid numeric value for ${field}`,);
                }
                data[field] = num;
            }
        }
        // Generate the MSSQL insert query
        const createQuery = generateMSSQLInsertQuery('Water_Harvesting', body);
        console.log(createQuery);
        await queryData(createQuery);

        res.send({
            code: 200,
            message: 'Success! The record was added to the system.',
        });

    } catch (error) {
        console.error('Error:', error);
        try {
            // In case of an error, clean up the local file if it exists
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }
        catch (error) { }

        res.status(500).send({
            code: 500,
            message: 'Error processing request', error,
        });
    }
});
app.post('/updateRecords', jsonParser, async (req, res) => {
    try {
        const { body } = req;
        const { inaugurationPhotoBase64, completionPhotoBase64, ID, ...updateFields } = body;

        let inaugurationPhotoUrl = null;
        let completionPhotoUrl = null;
        const randomNumber = Math.floor(Math.random() * 1000000);
        // Save and upload inauguration photo
        if (inaugurationPhotoBase64) {
            const matches = inaugurationPhotoBase64.match(/^data:image\/([a-zA-Z]+);base64,/);
            if (!matches || matches.length < 2) {
                return res.status(400).send({
                    code: 400,
                    message: 'Invalid image format',
                });
            }
            const imageType = matches[1];
            const imageName = `StartWorkPhoto_${randomNumber}.${imageType}`;
            const inaugurationImagePath = path.join(__dirname, imageName);
            // Remove any whitespaces or newlines from the base64 string
            const base64Data = inaugurationPhotoBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '').replace(/\s/g, '');
            // Write the decoded base64 data as binary
            fs.writeFileSync(inaugurationImagePath, base64Data, { encoding: 'base64' });
            inaugurationPhotoUrl = await uploadImageToFTP(inaugurationImagePath, imageName, 'Startwork');
            fs.unlinkSync(inaugurationImagePath); // Remove the temp file after upload
        }

        // Save and upload completion photo
        if (completionPhotoBase64) {
            const matches = completionPhotoBase64.match(/^data:image\/([a-zA-Z]+);base64,/);
            console.log(686, matches);
            if (!matches || matches.length < 2) {
                return res.status(400).send({
                    code: 400,
                    message: 'Invalid image format',
                });
            }
            const imageType = matches[1];
            const imageName = `Completion_${randomNumber}.${imageType}`;
            const completionImagePath = path.join(__dirname, imageName);

            // Remove any whitespaces or newlines from the base64 string
            const base64Data = completionPhotoBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '').replace(/\s/g, '');
            // Write the decoded base64 data as binary
            fs.writeFileSync(completionImagePath, base64Data, { encoding: 'base64' });
            completionPhotoUrl = await uploadImageToFTP(completionImagePath, imageName, 'Completion');
            console.log(completionImagePath);
            fs.unlinkSync(completionImagePath); // Remove the temp file after upload
        }

        // Prepare the update object
        const updateObject = {
            ...updateFields,
            Inauguration_PHOTO1: inaugurationPhotoUrl,
            COMPLETED_PHOTO1: completionPhotoUrl,
            LAST_UPD_DT: new Date().toISOString()
        };

        Object.keys(updateObject).forEach((key) => {
            if (!updateObject[key] || updateObject[key]?.length === 0) {
                delete updateObject[key]
            }
        })
        // Capitalize all data fields in the body .. updated by SUMIT
        for (const key in body) {
            if (typeof body[key] === 'string') {
                body[key] = body[key].toUpperCase();
            }
        }
        //Created by Jagdish
        // Example route with validation
        // Validate and convert numeric fields
        const numericFields = ['Latitude', 'Longitude', 'APPROX_AMOUNT'];
        const data = {};

        for (const field of numericFields) {
            if (req.body[field] === null) {
                data[field] = null;
            } else {
                const num = Number(req.body[field]);
                if (isNaN(num)) {
                    throw new Error(`Invalid numeric value for ${field}`);
                }
                data[field] = num;
            }
        }
        // Generate the MSSQL update query
        console.log(743, updateObject);
        const updateQuery = generateMSSQLUpdateQuery('Water_Harvesting', updateObject, { ID });
        console.log(745, updateQuery);


        // Execute the query
        await queryData(updateQuery);
        // Respond to the client
        res.send({
            code: 200,
            message: 'Data updated successfully',
            inaugurationPhotoUrl,
            completionPhotoUrl
        });
    } catch (error) {
        console.log(error);
        res.status(500).send({ code: 500, message: 'Error updating data', error });
    }
});

app.post('/newupdateRecords', jsonParser, async (req, res) => {
    try {
        const { body } = req;
        const { inaugurationPhotoBase64, completionPhotoBase64, ID, APPROX_AMOUNT, Latitude, Longitude, ...updateFields } = body;

        let inaugurationPhotoUrl = null;
        let completionPhotoUrl = null;
        const randomNumber = Date.now(); // Use a timestamp for uniqueness

        // Validate numeric fields
        const numericFields = { APPROX_AMOUNT, Latitude, Longitude };
        Object.keys(numericFields).forEach((key) => {
            const value = numericFields[key];
            if (value != null && isNaN(value)) {
                return res.status(400).send({
                    code: 400,
                    message: `Invalid value for ${key}: must be a number.`,
                });
            }
        });

        // Save and upload inauguration photo
        if (inaugurationPhotoBase64) {
            const matches = inaugurationPhotoBase64.match(/^data:image\/([a-zA-Z]+);base64,/);
            if (!matches || matches.length < 2) {
                return res.status(400).send({ code: 400, message: 'Invalid image format' });
            }
            const imageType = matches[1];
            const imageName = `StartWork_${randomNumber}.${imageType}`;
            const inaugurationImagePath = path.join(__dirname, imageName);
            const base64Data = inaugurationPhotoBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '').replace(/\s/g, '');
            fs.writeFileSync(inaugurationImagePath, base64Data, { encoding: 'base64' });
            inaugurationPhotoUrl = await uploadImageToFTP(inaugurationImagePath, imageName, 'StartWork');
            fs.unlinkSync(inaugurationImagePath);
        }

        // Save and upload completion photo
        if (completionPhotoBase64) {
            const matches = completionPhotoBase64.match(/^data:image\/([a-zA-Z]+);base64,/);
            if (!matches || matches.length < 2) {
                return res.status(400).send({ code: 400, message: 'Invalid image format' });
            }
            const imageType = matches[1];
            const imageName = `Completion_${randomNumber}.${imageType}`;
            const completionImagePath = path.join(__dirname, imageName);
            const base64Data = completionPhotoBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '').replace(/\s/g, '');
            fs.writeFileSync(completionImagePath, base64Data, { encoding: 'base64' });
            completionPhotoUrl = await uploadImageToFTP(completionImagePath, imageName, 'Completion');
            fs.unlinkSync(completionImagePath);
        }

        // Prepare the update object
        const updateObject = {
            ...updateFields,
            APPROX_AMOUNT: APPROX_AMOUNT != null ? parseFloat(APPROX_AMOUNT) : null,
            Latitude: Latitude != null ? parseFloat(Latitude) : null,
            Longitude: Longitude != null ? parseFloat(Longitude) : null,
            Inauguration_PHOTO1: inaugurationPhotoUrl,
            COMPLETED_PHOTO1: completionPhotoUrl,
            LAST_UPD_DT: new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).toISOString()
            //new Date().toISOString(),
        };
        //  body.LAST_UPD_ID = user.userId;
        Object.keys(updateObject).forEach((key) => {
            if (updateObject[key] == null || (typeof updateObject[key] === 'string' && updateObject[key].trim() === '')) {
                delete updateObject[key];
            }
        });

        // Generate and execute the MSSQL update query
        const updateQuery = generateMSSQLUpdateQuery('Water_Harvesting', updateObject, { ID });
        await queryData(updateQuery);

        // Respond to the client
        res.send({
            code: 200,
            message: 'Data updated successfully',
            inaugurationPhotoUrl,
            completionPhotoUrl,
        });
    } catch (error) {
        console.error('Error updating records:', error);
        res.status(500).send({
            code: 500,
            message: 'Error updating data. Please try again later.',
            error: error.message || 'Unknown error',
        });
    }
});


app.get('/fetchRecords', async (req, res) => {
    try {
        const { District, Village, Taluka, SearchText, ShowInaugurated, ShowCompleted } = req.query;
        const { authorization } = req.body;
        const token = authorization && authorization?.split(' ')[1]
        let user;
        // console.log(862,"Start Verify Token",res);
        // if(token){
        //   user = await verifyToken(token,process.env.JWTSECRET);
        //   console.log(865,"User Token="),user;
        //   if(!user){
        //     res.send({
        //       code:400,
        //       message:'Invalid User'
        //     })
        //   }
        // }
        // Console.log(873,"Token Verfied Successfully...")
        // Initialize the conditions array
        const conditions = [];

        // Add conditions if the values are not null
        if (District && District != 'null') conditions.push(`DISTRICT = '${District}'`);
        if (Taluka && Taluka != 'null') conditions.push(`TALUKA = '${Taluka}'`);
        if (Village && Village != 'null') conditions.push(`VILLAGE = '${Village}'`);
        if (SearchText && SearchText != 'null') conditions.push(`(DISTRICT LIKE '%${SearchText}%' OR TALUKA LIKE '%${SearchText}%' OR VILLAGE LIKE '%${SearchText}%')`);
        if (ShowInaugurated === 'true') conditions.push(`Inauguration_DATE IS NOT NULL`);
        if (ShowCompleted === 'true') conditions.push(`COMPLETED_DATE IS NOT NULL`);

        // Join the conditions with AND operator
        const conditionsString = conditions.join(' AND ');

        // Queries
        const totalRecordsQuery = `SELECT COUNT(*) as totalRecords FROM Water_Harvesting ${conditionsString ? `WHERE ${conditionsString}` : ''}`;
        const fetchTalukaRecordsQuery = `SELECT * FROM Water_Harvesting ${conditionsString ? `WHERE ${conditionsString}` : ''} ORDER BY ID`;
        // console.log(890,fetchTalukaRecordsQuery);
        // console.log(891,totalRecordsQuery);

        // Execute both queries in parallel using Promise.all
        const [totalRecords, fetchTalukaRecords] = await Promise.all([
            queryData(totalRecordsQuery),
            queryData(fetchTalukaRecordsQuery)
        ]);

        // Send success response
        res.send({
            code: 200,
            message: "Data Fetch Successful",
            data: {
                totalCount: totalRecords.recordset[0].totalRecords,  // Access the first record of the result set
                data: fetchTalukaRecords.recordset                   // Return the fetched records
            }
        });
    } catch (error) {
        // Send error response without referencing undefined variables
        res.send({
            code: 500,
            message: error.message,
            data: null  // No data in case of error
        });
    }
});
app.get('/fetchStatus', async (req, res) => {
    const { District } = req.query;
    const strQry = `SELECT DISTRICT,TALUKA,IMPLIMANTATION_AUTHORITY,COUNT(*) as TOTAL,count(Inauguration_PHOTO1) as START_PHOTO,count(COMPLETED_PHOTO1) as COMPLETED_PHOTO FROM Water_Harvesting WHERE DISTRICT = '${District}' GROUP BY DISTRICT,TALUKA,IMPLIMANTATION_AUTHORITY ORDER BY DISTRICT,TALUKA,IMPLIMANTATION_AUTHORITY`;

    const response = await queryData(strQry);
    res.send({
        code: 200,
        message: "Success",
        data: response.recordsets[0]
    })
})


app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Initialize base query
        let query = `SELECT * FROM tblUSER WHERE USR_NM = '${username}'`;

        // Add conditions to the query dynamically based on non-null values
        if (username) {
            query += ` AND USR_NM = '${username}'`;
        }
        if (password) {
            query += ` AND USR_PWD = '${password}'`;
        }


        // Execute the query
        const response = await queryData(query);
        //   console.log(response.recordset);

        if (response && response.recordset.length > 0) {
            const userId = response.recordset[0].ID;
            const userType = response.recordset[0].USR_TYPE;
            const isAdmin = response.recordset[0].isADMIN;
            const accessToken = jwt.sign({ userId, isAdmin, userType }, jwtSecret, {
                expiresIn: "100000d",
            });

            res.send({
                code: 200,
                message: "User Found",
                token: accessToken,
                userData: response.recordset[0]
            });
            return;
        }

        res.send({
            code: 404,
            message: "User Not Found",
        });
    } catch (error) {
        res.send({
            code: 500,
            message: error.message,
        });
    }
});


app.get('/getSliderImages', async (req, res) => {
    res.send({
        code: 200,
        data: await getSliderImages()
    });
})


app.post('/register', async (req, res) => {
    try {
        const { username, password, email, isAdmin, isActive, district, taluka, userType } = req.body;

        // Convert boolean values to 1 (true) or 0 (false)
        const isAdminValue = isAdmin ? 1 : 0;
        const isActiveValue = isActive ? 1 : 0;

        // Generate a random number and create the combination value
        const randomNumber = Math.floor(Math.random() * 10000); // 4-digit random number
        const combinationValue = `${district}_${taluka}_${username}_${randomNumber}`;

        // Insert user data into the table
        const query = `
        INSERT INTO tblUSER (
          USR_NM, USR_PWD, EMAIL_ID, isADMIN, isACTIVE, DISTRICT, TALUKA, USR_TYPE, USR_ID
        ) VALUES (
          '${username}', '${password}', '${email}', ${isAdminValue}, ${isActiveValue}, '${district}', '${taluka}', ${userType}, '${combinationValue}'
        )
      `;

        // Execute the query
        console.log(query);
        const response = await queryData(query);

        res.send({
            code: 200,
            message: "User Registered Successfully",
        });
    } catch (error) {
        res.send({
            code: 500,
            message: error.message,
        });
    }
});

app.post('/resetImage', async (req, res) => {
    try {
        console.log(625, req.body)
        const { recordId, type } = req.body;

        let query = `UPDATE Water_Harvesting SET `;

        if (type) {
            query = query + `Inauguration_PHOTO1 = NULL`
        }
        else {
            query = query + `COMPLETED_PHOTO1 = NULL`
        }

        query = query + ` WHERE Id = '${recordId}'`;

        console.log(638, query)
        await queryData(query);

        res.send({
            code: 200,
            message: 'Done'
        })

    } catch (error) {
        res.send({
            code: 500,
            message: error.message,
        });
    }
})
app.delete('/DeleteRecord/:id', async (req, res) => {
    try {
        const recordId = req.params.id;
        console.log(867, recordId);
        // Validate input
        if (!recordId) {
            return res.status(400).json({
                code: 400,
                message: 'Record ID is required'
            });
        }

        // Delete query with parameterized input
        const query = `DELETE FROM Water_Harvesting WHERE Id = ?`;
        
        // Execute delete query
        const result = await queryData(query, [recordId]);

        // Check if any record was actually deleted
        if (result.affectedRows === 0) {
            return res.status(404).json({
                code: 404,
                message: 'No record found with the given ID'
            });
        }

        // Successful deletion
        res.status(200).json({
            code: 200,
            message: 'Record deleted successfully'
        });

    } catch (error) {
        console.error('Delete record error:', error);
        res.status(500).json({
            code: 500,
            message: 'Internal server error',
            error: error.message
        });
    }
});

app.get('/getDistricts', async (req, res) => {
   try {
        const getAllDistrictsQuery = `SELECT DISTINCT DISTRICT,DIST_NO FROM V_VILLAGE order by DISTRICT`;
        //const getAllDistrictsQuery = `SELECT DISTINCT DISTRICT FROM Water_Harvesting`;

        const districts = await queryData(getAllDistrictsQuery);

        res.send({
            code: 200,
            message: "Success",
            data: districts.recordset
        });
    } catch (error) {
        res.status(500).send({
            code: 500,
            message: error.message
        });
    }
});

app.get('/getTalukas', async (req, res) => {
    try {
        const { District } = req.query;

        if (!District) {
            return res.status(400).send({
                code: 400,
                message: "District is required"
            });
        }

        const getTalukasQuery = `SELECT DISTINCT TALUKA FROM V_VILLAGE WHERE DISTRICT = '${District}' order by TALUKA`;
        //const getTalukasQuery = `SELECT DISTINCT TALUKA FROM Water_Harvesting WHERE DISTRICT = '${District}'`;

        const talukas = await queryData(getTalukasQuery);

        res.send({
            code: 200,
            message: "Success",
            data: talukas.recordset
        });
    } catch (error) {
        res.status(500).send({
            code: 500,
            message: error.message
        });
    }
});

app.get('/getVillages', async (req, res) => {
    try {
        const { District, Taluka } = req.query;
        //const { Taluka } = req.query;

        if (!District || !Taluka) {
            return res.status(400).send({
                code: 400,
                message: "Both District and Taluka are required"
            });
        }

        const getVillagesQuery = `SELECT DISTINCT VILLAGE FROM V_VILLAGE WHERE DISTRICT='${District}' and TALUKA = '${Taluka}' ORDER BY VILLAGE`;
        //const getVillagesQuery = `SELECT DISTINCT VILLAGE FROM Water_Harvesting WHERE TALUKA = '${Taluka}'`;

        const villages = await queryData(getVillagesQuery);
        // console.log(villages);
        res.send({
            code: 200,
            message: "Success",
            data: villages.recordset
        });
    } catch (error) {
        res.status(500).send({
            code: 500,
            message: error.message
        });
    }
});

app.get('/getImplimantationAuthority', async (req, res) => {
    try {
        const { District } = req.query;
        const strQry = `SELECT * FROM mstImplimantationAuthority`;

        const ImplimantationAuthority = await queryData(strQry);

        res.send({
            code: 200,
            message: "Success",
            data: ImplimantationAuthority.recordset
        });
    } catch (error) {
        res.status(500).send({
            code: 500,
            message: error.message
        });
    }
});
app.get('/getRoute', async (req, res) => {
    try {
        const { District } = req.query;

        if (!District) {
            return res.status(400).send({
                code: 400,
                message: "District is required"
            });
        }

        const getTalukasQuery = `SELECT DISTINCT TALUKA FROM V_VILLAGE WHERE DISTRICT = '${District}' order by TALUKA`;
        //const getTalukasQuery = `SELECT DISTINCT TALUKA FROM Water_Harvesting WHERE DISTRICT = '${District}'`;

        const talukas = await queryData(getTalukasQuery);

        res.send({
            code: 200,
            message: "Success",
            data: talukas.recordset
        });
    } catch (error) {
        res.status(500).send({
            code: 500,
            message: error.message
        });
    }
});
app.get('/getReportList', async (req, res) => {
    try {
        const getReportListQuery = `SELECT * FROM [iVMS].[dbo].[tblReport] order by id`;

        const ReportList = await queryData(getReportListQuery);

        res.send({
            code: 200,
            message: "Success",
            data: ReportList.recordset
        });
    } catch (error) {
        res.status(500).send({
            code: 500,
            message: error.message
        });
    }
});
app.get('/getReportData', async (req, res) => {
    try {
        const { REPORTTYPE } = req.query;

        if (!REPORTTYPE) {
            return res.status(400).send({
                code: 400,
                message: `Report type is  required321 ${REPORTTYPE} !`
            });
        }

        //  const getVillagesQuery = `SELECT DISTINCT VILLAGE FROM V_VILLAGE WHERE TALUKA = '${Taluka}' ORDER BY VILLAGE`;
        //const getVillagesQuery = `SELECT DISTINCT VILLAGE FROM Water_Harvesting WHERE TALUKA = '${Taluka}'`;
        const getReportQuery = `SELECT REPORT_QUERY FROM [iVMS].[dbo].[tblReport] where REPORT_TYPE='${REPORTTYPE}'`;
        const QueryData = await queryData(getReportQuery);
        const qdata = QueryData.recordset[0]?.REPORT_QUERY || ''; // Gets first column (REPORT_QUERY) from first row
        const QueryData1 = await queryData(qdata);
        res.send({
            code: 200,
            message: `Success `,
            data: QueryData1.recordset
        });
    } catch (error) {
        res.status(500).send({
            code: 500,
            message: error.message
        });
    }
});
app.listen(process.env.PORT || 1099, '0.0.0.0', () => {
    console.log(`JalShakti BE App listening on port 1099`);
})