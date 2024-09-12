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

function uploadImageToFTP(imagePath, imageName) {
    return new Promise((resolve, reject) => {
        const client = new Client();
        
        client.on('ready', () => {
            console.log('FTP connection ready');

            client.put(imagePath, imageName, (err) => {
                if (err) {
                    console.error('Error uploading file:', err);
                    reject('Error uploading file: ' + err);
                } else {
                    console.log('File uploaded successfully');

                    // Construct the public URL
                    const publicUrl = `http://jalshakti.co.in/${imageName}`;
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
    console.log(62,insertObject);
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
   
  
  

app.get('/getAllLocationForDistricts',async(req,res)=>{
    try{
        const { DISTRICT } = req.query;
        const response = await queryData(`SELECT Latitude,longitude,Village,Location,Inauguration_DATE,Inauguration_PHOTO1,COMPLETED_PHOTO1 from Water_Harvesting WHERE DISTRICT='${DISTRICT}' AND Latitude IS NOT NULL AND Longitude IS NOT NULL`);

        res.send({
            code:200,
            message:200,
            data:response.recordsets[0]
        })

    }
    catch(error){
        return {
            code:500,
            message:error.message
        }
    }
})

app.get('/getAllDistrics',async(req,res)=>{
    const response = await queryData(`select Distinct DISTRICT from Water_Harvesting`);
    res.send({
        code:200,
        message:"Success",
        data:response.recordsets[0]
    })
})

app.get('/getPicklistValues',async(req,res)=>{
    try{
        const response = await queryData(`select Distinct DISTRICT,TALUKA,VILLAGE from Water_Harvesting`);
        res.send({
            code:200,
            message:"Success",
            data:response.recordsets[0]
        })
    }
    catch(error){
        return {
            code:500,
            message:error.message
        }
    }
})

app.get('/getDashboardValues', async (req, res) => {
    const { DISTRICT } = req.query; // Get DISTRICT from query parameters

    // Use parameterized queries to prevent SQL injection
    const talukasCountQuery = `SELECT COUNT(*) as Total_Distinct_Taluka_Count 
                               FROM (SELECT DISTINCT TALUKA FROM Water_Harvesting WHERE DISTRICT = '${DISTRICT}') AS DistinctTalukas`;
    
    const villageCountQuery = `SELECT COUNT(*) as Total_Distinct_Village_Count 
                               FROM (SELECT DISTINCT VILLAGE FROM Water_Harvesting WHERE DISTRICT = '${DISTRICT}') AS DistinctVillages`;

    const inaugrationCountQuery = `SELECT COUNT(*) as Total_Inaugration_Count 
                               FROM (SELECT * FROM Water_Harvesting WHERE DISTRICT = '${DISTRICT}' AND Inauguration_DATE IS NOT NULL) AS DistinctVillages`;
    
    const completionCountQuery = `SELECT COUNT(*) as Total_completion_Count 
                               FROM (SELECT * FROM Water_Harvesting WHERE DISTRICT = '${DISTRICT}' AND COMPLETED_DATE IS NOT NULL) AS DistinctVillages`;
    
    const totalTargetQuery = `SELECT COUNT(*) as Total_Target_Records FROM Water_Harvesting WHERE DISTRICT = '${DISTRICT}'`;

    const getPieChartValue = `SELECT DISTINCT TALUKA,Count(*) as count FROM Water_Harvesting WHERE DISTRICT = '${DISTRICT}' GROUP BY TALUKA;`
  
    const totalCountQuery = `SELECT COUNT(*) as Total_Records FROM Water_Harvesting`

    const getStackedBarChartValue = `SELECT TALUKA, ENG_GRANT, COUNT(*) AS count FROM Water_Harvesting WHERE DISTRICT = '${DISTRICT}' GROUP BY TALUKA, ENG_GRANT;`

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
        console.log(talukasCount);
        const finalResponse = {
            talukasCount:talukasCount.recordset[0].Total_Distinct_Taluka_Count,
            villageCount:villageCount.recordset[0].Total_Distinct_Village_Count,
            inaugrationCount:inaugrationCount.recordset[0].Total_Inaugration_Count,
            completionCount:completionCount.recordset[0].Total_completion_Count,
            totalTargetCount:totalTargetCount.recordset[0].Total_Target_Records,
            totalRecordCount:totalCount.recordset[0].Total_Records,
            pieChart:pieChart.recordset,
            stackedBarChart:stackedBarChar.recordset        
        }
            // targetCount.recordset[0]
        

        res.send(finalResponse);
    } catch (error) {
        console.error('Error querying database:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/getAllTargets',async(req,res)=>{
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


app.post('/createRecords', jsonParser, async (req, res) => {
    const { body } = req;
    const { Inauguration_PHOTO1 } = body; // Assume the base64 image is passed in this field

    try {
        // Validate if Inauguration_PHOTO1 exists and is a valid base64 string
        if (!Inauguration_PHOTO1 || !Inauguration_PHOTO1.startsWith('data:image/')) {
            return res.status(400).send({
                code: 400,
                message: 'Invalid or missing base64 image data',
            });
        }

        // Generate a random number for the image name
        const randomNumber = Math.floor(Math.random() * 1000000);
        const imageName = `Inauguration_${randomNumber}.png`;

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
        const imagePath = `./Inauguration_${randomNumber}.${imageType}`;

        // Remove any whitespaces or newlines that may corrupt the image
        const base64Data = Inauguration_PHOTO1.replace(/^data:image\/[a-zA-Z]+;base64,/, '').replace(/\s/g, '');

        // Write the decoded base64 data as binary
        fs.writeFileSync(imagePath, base64Data, { encoding: 'base64' });

        // Upload the image to FTP and get the public URL
        const publicUrl = await uploadImageToFTP(imagePath, imageName);

        // Store the public URL in the request body
        body.Inauguration_PHOTO1 = publicUrl;

        // Delete the local file after FTP upload
        fs.unlinkSync(imagePath);

        // Generate the MSSQL insert query
        const createQuery = generateMSSQLInsertQuery('Water_Harvesting', body);
        await queryData(createQuery);

        res.send({
            code: 200,
            message: 'Data Created',
        });

    } catch (error) {
        console.error('Error:', error);

        // In case of an error, clean up the local file if it exists
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }

        res.status(500).send({
            code: 500,
            message: 'Error processing request',
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
            const imageName = `Inauguration_${randomNumber}.${imageType}`;
            const inaugurationImagePath = path.join(__dirname, imageName);
            // Remove any whitespaces or newlines from the base64 string
            const base64Data = inaugurationPhotoBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '').replace(/\s/g, '');
            // Write the decoded base64 data as binary
            fs.writeFileSync(inaugurationImagePath, base64Data, { encoding: 'base64' });
            inaugurationPhotoUrl = await uploadImageToFTP(inaugurationImagePath, imageName);
            fs.unlinkSync(inaugurationImagePath); // Remove the temp file after upload
        }

        // Save and upload completion photo
        if (completionPhotoBase64) {
            const matches = completionPhotoBase64.match(/^data:image\/([a-zA-Z]+);base64,/);
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
            completionPhotoUrl = await uploadImageToFTP(completionImagePath, imageName);
            console.log(completionImagePath);
            fs.unlinkSync(completionImagePath); // Remove the temp file after upload
        }

        // Prepare the update object
        const updateObject = {
            ...updateFields,
            Inauguration_PHOTO1: inaugurationPhotoUrl,
            COMPLETED_PHOTO1: completionPhotoUrl
        };
        // Generate the MSSQL update query
        const updateQuery = generateMSSQLUpdateQuery('Water_Harvesting', updateObject, { ID });
        console.log(updateQuery);


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

app.get('/fetchRecords', async (req, res) => {
    try {
      const { District, Village, Taluka, offSet } = req.query;
      // Initialize the conditions array
      const conditions = [];
  
      // Add conditions if the values are not null
      if (District && District != 'null') conditions.push(`DISTRICT = '${District}'`);
      if (Village && Village != 'null') conditions.push(`VILLAGE = '${Village}'`);
      if (Taluka && Taluka != 'null') conditions.push(`TALUKA = '${Taluka}'`);
  
      // Join the conditions with AND operator
      const conditionsString = conditions.join(' AND ');
  
      // Queries
      const totalRecordsQuery = `SELECT COUNT(*) as totalRecords FROM Water_Harvesting ${conditionsString ? `WHERE ${conditionsString}` : ''}`;
      const fetchTalukaRecordsQuery = `SELECT * FROM Water_Harvesting ${conditionsString ? `WHERE ${conditionsString}` : ''} ORDER BY ID`;
  
      console.log(fetchTalukaRecordsQuery);
  
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
  

  app.post('/login',async(req,res)=>{
    try{
        const {username,password} = req.body;
        const query = `Select * FROM tblUSER WHERE USR_NM = '${username}' AND USR_PWD = '${password}'`;

        const response = await queryData(query);
        console.log(response.recordset);

        if(response && response.recordset.length > 0){
            const userId = response.recordset.USR_ID
            const accessToken = jwt.sign({ userId }, jwtSecret, {
                expiresIn: "100000d",
              });

            res.send({
                code:200,
                message:"User Found",
                token:accessToken              
            })
            return
        }
        res.send({
            code:404,
            message:"User Not Found"
        })
    }
    catch(error){
        res.send({
            code: 500,
            message: error.message,
          });
    }
  })

app.listen(process.env.PORT || 3000,()=>{
    console.log(`App listening on port 3000`);
})