'use strict'
var request = require('supertest')
var app = require('../../server/server.js')
app.dataSources.db = loopback.createDataSource({
  connector: loopback.Memory
})
var loopback = require('loopback')

beforeEach(() => {
  app.set('adminIps', [])
})

describe('Subscription API', function () {
  it('get subscriptions by anonymous users', function (done) {
    request(app).get('/api/subscriptions')
      .end(function (err, res) {
        expect(res.statusCode).toBe(403)
        done()
      })
  })
})