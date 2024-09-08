import "dotenv/config"
import express, { response } from 'express';
import bodyParser from 'body-parser';
import { queryData } from './dbconfig.js';
import cors from 'cors';
import Crypto from "crypto-js";
import jwt from "jsonwebtoken";


const jwtSecret = process.env.JWTSECRET;
let key = Crypto.enc.Base64.parse(process?.env?.AESSECRET);
let iv = Crypto.enc.Hex.parse("00000000000000000000000000000000");


var jsonParser = bodyParser.json()
const app = express();

app.use(cors());

app.use(express.json({ limit: '50mb' }));

function generateMSSQLInsertQuery(tableName, insertObject) {
    // Get the keys and values from the object
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

app.get('/getAllLocationForDistricts',async(req,res)=>{
    try{
        const { DISTRICT } = req.query;
        const response = await queryData(`SELECT Latitude,longitude,Village from Water_Harvesting WHERE DISTRICT='${DISTRICT}' AND Latitude IS NOT NULL AND Longitude IS NOT NULL`);

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

app.post('/createRecords',jsonParser,async (req,res)=>{
    const { body } = req;
    const createQuery = generateMSSQLInsertQuery('Water_Harvesting1',body);
    await queryData(createQuery);

    res.send({
        code:200,
        message:"Data Created"
    })
})

app.get('/fetchRecords', async (req, res) => {
    try {
      const { Taluka, offSet } = req.query;
    
      // Queries
      const totalRecordsQuery = `SELECT COUNT(*) as totalRecords FROM Water_Harvesting WHERE TALUKA = '${Taluka}'`;
      const fetchTalukaRecordsQuery = `SELECT * FROM Water_Harvesting WHERE TALUKA='${Taluka}' ORDER BY ID OFFSET ${offSet ? offSet : 0} ROWS FETCH NEXT 11 ROWS ONLY;`;
    
      console.log(`SELECT * FROM Water_Harvesting WHERE TALUKA='${Taluka}' ORDER BY ID OFFSET ${offSet ? offSet : 0} ROWS FETCH NEXT 11 ROWS ONLY`)
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