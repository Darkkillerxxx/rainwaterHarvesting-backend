import sql from 'mssql'

var connection = {
    // server     : '103.116.176.242',
    // user     : 'yojna',
    // password : 'iis#2022',
    // database : 'iVMS',
    user     : 'sa',
    password : 'iis#2025',
    database : 'iVMS',
    server     : '108.181.203.8',// Explicitly use IP instead of localhost
    port: 1433, // Explicitly specify port
    pool:{
        max:10,
        min:0,
        idleTimeoutMillis:150000
    },
    options: {
        encrypt: false,
        trustServerCertificate: true, // Changed to true for local development
        instanceName: 'SQLEXPRESS' // If using a named instance
      },
      requestTimeout: 60000,    
};

export const queryData = async(query) =>{
    try{
        await sql.connect(connection);
        const response = await sql.query(query);
        return response ? response : null
    }catch(error){
        throw error
    }
}

export default connection;