# appsforhere
[![Build Status](https://travis-ci.org/paypal/appsforhere.png)](https://travis-ci.org/paypal/appsforhere)

A [Kraken](http://krakenjs.com/) 1.x based node.js web application to add functionality to PayPal Here and related
PayPal Retail systems. This application uses external APIs only and thus can be customized and deployed
pretty much anywhere.

This is a very "green" project - there are undoubtedly loads of bugs and room for improvement. But that's why you're
here. File issues and make pull requests!

You can [try it out on our server](https://appsforhere.ebayc3.com) with a PayPal account.

** PLEASE NOTE **
For improved performance, these modules should be installed globally to ensure native modules where appropriate:

* [mongoose](http://mongoosejs.com/) ^3.8.15
* connect-mongo ^0.5.3
* [lwip](https://github.com/EyalAr/lwip)
* [pm2](https://github.com/unitech/pm2)
* socket.io ^1.1.0
* mubsub

And then you must set the NODE_DIR environment variable to your global module directory. We do this to enable git deploy
with the same package.json. Also note there is a specific grunt target for heroku which will take these dependencies and
add them to the package.json deployed to heroku since heroku has no such thing as global installs.

The server also requires the following environment variables:

* NEWRELIC_APP, NEWRELIC_KEY - the app name and key for New Relic monitoring

** ALSO NOTE **
The PayPal OAuth scopes for many of the APIs used here must be manually enabled for your application (i.e. they are
not self-service). Hopefully this will change in the near future, but until then just private message me and I will try
to help if you don't already have access. Your app needs the following scopes:

* email
* profile
* https://uri.paypal.com/services/paypalhere 
* https://uri.paypal.com/services/paypalattributes
 
The sandbox credentials are embedded in the source and you can mess with
your hosts file to make the returnUrl work.

## Useful Components

Appsforhere uses the following components which might be useful to look at if you're doing the same types of interactions:

* passport - for integrating PayPal Access/Login With PayPal with Kraken/Express
* Twilio - for SMS awesomesauce
* Mailgun - for such SMTP
* mongodb-queue - to manage queuing mail and sms jobs
* socket.io - to stream server farm logs to the admin page. This is a bit tricky to get right with Kraken, so check index.js
* d3.js - if you copy my d3 code that would make it like 4th hand