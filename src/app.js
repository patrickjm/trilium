const log = require('./services/log');
const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const sessionSecret = require('./services/session_secret');
const dataDir = require('./services/data_dir');
const utils = require('./services/utils');
const { version } = require('../package.json');
require('./services/handlers');
require('./becca/becca_loader');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(helmet({
    hidePoweredBy: false, // errors out in electron
    contentSecurityPolicy: false
}));

app.use((req, res, next) => {
    res.setHeader('x-trilium-version', version);
    next();
});

app.use(express.text({limit: '500mb'}));
app.use(express.json({limit: '500mb'}));
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/libraries', express.static(path.join(__dirname, '..', 'libraries')));
app.use('/images', express.static(path.join(__dirname, '..', 'images')));
const sessionParser = session({
    secret: sessionSecret,
    resave: false, // true forces the session to be saved back to the session store, even if the session was never modified during the request.
    saveUninitialized: false, // true forces a session that is "uninitialized" to be saved to the store. A session is uninitialized when it is new but not modified.
    cookie: {
        //    path: "/",
        httpOnly: true,
        maxAge:  24 * 60 * 60 * 1000 // in milliseconds
    },
    name: 'trilium.sid',
    store: new FileStore({
        ttl: 30 * 24 * 3600,
        path: dataDir.TRILIUM_DATA_DIR + '/sessions'
    })
});
app.use(sessionParser);

app.use(favicon(__dirname + '/../images/app-icons/win/icon.ico'));

require('./routes/routes').register(app);

require('./routes/custom').register(app);

app.use((err, req, res, next) => {
    if (err.code !== 'EBADCSRFTOKEN') {
        return next(err);
    }

    log.error(`Invalid CSRF token: ${req.headers['x-csrf-token']}, secret: ${req.cookies['_csrf']}`);

    err = new Error('Invalid CSRF token');
    err.status = 403;
    next(err);
});

// catch 404 and forward to error handler
app.use((req, res, next) => {
    const err = new Error('Router not found for request ' + req.url);
    err.status = 404;
    next(err);
});

// error handler
app.use((err, req, res, next) => {
    if (err && err.message && (
        (err.message.includes("Router not found for request") && err.message.includes(".js.map"))
        || (err.message.includes("Router not found for request") && err.message.includes(".css.map"))
    )) {
        // ignore
    }
    else {
        log.info(err);
    }

    res.status(err.status || 500);
    res.send({
        message: err.message
    });
});

// triggers sync timer
require('./services/sync');

// triggers backup timer
require('./services/backup');

// trigger consistency checks timer
require('./services/consistency_checks');

require('./services/scheduler');

if (utils.isElectron()) {
    require('@electron/remote/main').initialize();
}

module.exports = {
    app,
    sessionParser
};
