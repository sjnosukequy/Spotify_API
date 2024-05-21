const postgres = require('postgres');

const sql = postgres('postgres://14.225.192.27:5432/postgres', {
    host: '14.225.192.27',            // Postgres ip address[s] or domain name[s]
    port: 5432,          // Postgres server port[s]
    database: 'postgres',            // Name of database to connect to
    username: 'postgres',            // Username of database user
    password: '123',            // Password of database user
    prepare: true,
})

module.exports = {sql}