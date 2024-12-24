import sql from 'mssql'

var connection = {
    server     : '103.116.176.242',
    user     : 'yojana',
    password : 'iis#2022',
    database : 'iVMS',
    pool:{
        max:10,
        min:0,
        idleTimeoutMillis:150000
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