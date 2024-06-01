const postgres = require('postgres');

const sql = postgres('postgres://YOUR_BACKEND_IP:5432/postgres', {
    host: 'YOUR_BACKEND_IP',            // Postgres ip address[s] or domain name[s]
    port: 5432,          // Postgres server port[s]
    database: 'postgres',            // Name of database to connect to
    username: 'postgres',            // Username of database user
    password: '123',            // Password of database user
    prepare: true,
})

module.exports = {sql}