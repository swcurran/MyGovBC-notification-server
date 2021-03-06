let server
const request = require('request')
module.exports.request = request
module.exports.app = function(cb) {
  if (server) {
    return cb && process.nextTick(cb.bind(null, null, server))
  }
  const SMTPServer = require('smtp-server').SMTPServer
  const validEmailRegEx = /un-(.+?)-(.*)@(.+)/
  const _ = require('lodash')
  const getOpt = require('node-getopt')
    .create([
      [
        'a',
        'api-url-prefix=<string>',
        'NotifyBC api url prefix; default to http://localhost:3000/api'
      ],
      [
        'd',
        'allowed-smtp-domains=<string>+',
        'allowed recipient email domains; if missing all are allowed; repeat the option to create multiple entries.'
      ],
      [
        'p',
        'listening-smtp-port=<integer>',
        'if missing a random free port is chosen. Proxy is required if port is not 25.'
      ],
      ['o', 'smtp-server-options', 'stringified json smtp server options'],
      ['h', 'help', 'display this help']
    ])
    .bindHelp(
      'Usage: node ' + process.argv[1] + ' [Options]\n[Options]:\n[[OPTIONS]]'
    )
  const args = getOpt.parseSystem()
  const urlPrefix =
    args.options['api-url-prefix'] ||
    process.env.API_URL_PREFIX ||
    'http://localhost:3000/api'
  const port =
    args.options['listening-smtp-port'] || process.env.LISTENING_SMTP_PORT || 0
  const allowedSmtpDomains =
    (args.options['allowed-smtp-domains'] &&
      args.options['allowed-smtp-domains'].map(e => e.toLowerCase())) ||
    (process.env.ALLOWED_SMTP_DOMAINS &&
      process.env.ALLOWED_SMTP_DOMAINS
        .split(',')
        .map(e => e.trim().toLowerCase()))
  const smtpOptsString =
    args.options['smtp-server-options'] || process.env.SMTP_SERVER_OPTIONS
  let smtpOpts = (smtpOptsString && JSON.parse(smtpOptsString)) || {}
  smtpOpts = _.assign({}, smtpOpts, {
    authOptional: true,
    disabledCommands: ['AUTH'],
    onRcptTo(address, session, callback) {
      try {
        let match = address.address.match(validEmailRegEx)
        if (match) {
          let domain = match[3]
          if (
            !allowedSmtpDomains ||
            allowedSmtpDomains.indexOf(domain.toLowerCase()) >= 0
          )
            return callback()
        }
      } catch (ex) {}
      return callback(new Error('invalid recipient'))
    },
    onData(stream, session, callback) {
      stream.on('data', chunk => {})
      stream.on('end', () => {
        session.envelope.rcptTo.forEach(e => {
          let match = e.address.match(validEmailRegEx)
          let id = match[1]
          let unsubscriptionCode = match[2]
          exports.request.get({
            url:
              urlPrefix +
              '/subscriptions/' +
              id +
              '/unsubscribe?unsubscriptionCode=' +
              encodeURIComponent(unsubscriptionCode) +
              '&userChannelId=' +
              encodeURIComponent(session.envelope.mailFrom.address),
            headers: {
              /*jshint camelcase: false */
              is_anonymous: true
            }
          })
        })
        callback(null)
      })
    }
  })
  server = new SMTPServer(smtpOpts)
  server.listen(port, function() {
    console.info(
      `smtp server started listening on port ${this.address()
        .port}  with:\napi-url-prefix=${urlPrefix}`
    )
    allowedSmtpDomains &&
      console.info(`allowed-smtp-domains=${allowedSmtpDomains}`)
    cb && cb(null, server)
  })
}
if (require.main === module) {
  module.exports.app()
}
