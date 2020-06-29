/* eslint-env and, mocha */
/* global request */

describe('GET /addresses', () => {
  it('respond with json', done => {
    request
      .get('/addresses')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200, done)
  })
})
