module.exports = {
    db: {
        connector: process.env.DB_CONNECTOR,
        hostname: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DATABASE
    }
}