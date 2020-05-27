module.exports = {
    'url': `mongodb://${process.env.MONGO || "127.0.0.1"}:27017${process.env.NODE_ENV == 'test' ? '/prauxy-test' : ''}`
}