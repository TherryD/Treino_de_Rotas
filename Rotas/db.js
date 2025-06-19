const mysql = require('mysql2');

// Cria uma conexção "pool".
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'anotacoes_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
})

// Transformar o pool em uma versão que usa "Promises"
const promisePool = pool.promise()

// Exportar o pool 
module.exports = promisePool;