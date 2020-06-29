import * as app from '../server'

export const executeSQL = sql => {
  return new Promise((resolve, reject) => {
    const connector = app.dataSources.db.connector
    connector.execute(sql, null, (err, res) => {
      if (err) {
        return reject(err)
      }
      return resolve(res)
    })
  })
}
