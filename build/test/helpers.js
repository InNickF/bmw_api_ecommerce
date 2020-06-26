/* eslint-env and, mocha */

const request = require('supertest')
const chai = require('chai')
const app = require('../server/server.js')

global.app = app
global.expect = chai.expect
global.request = request(app)
