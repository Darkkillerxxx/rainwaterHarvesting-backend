import sql from 'mssql'

var connection = {
    server     : '123.253.12.12',
    user     : 'yojna',
    password : 'ICoVKSUPsAVgC9K',
    database : 'iVMS',
    port : 3572,
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
//Rechange
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