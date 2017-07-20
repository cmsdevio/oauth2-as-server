const meta = require('./package');
const MongoClient = require('mongodb').MongoClient;

exports.register = (server, options, next) => {
  MongoClient.connect(options.url, (err, database) => {
    if (err) {
      next(err);
    } else {
      console.log('Database connection successfully initiated.');
      server.app.db = database;
    }
  });

  next();
};

exports.register.attributes = {
  pkg: meta,
};
