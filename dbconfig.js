import sql from 'mssql'

var connection = {
    server     : '83.229.87.8',
    user     : 'EMS',
    password : 'artisan$123',
    database : 'iVMS',
    pool:{
        max:10,
        min:0,
        idleTimeoutMillis:30000
    },
    options:{
        encrypt:false,
        trustServerCertificate:false
    }
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