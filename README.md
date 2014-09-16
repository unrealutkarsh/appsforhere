# appsforhere

A [Kraken](http://krakenjs.com/) 1.x based node.js web application to add functionality to PayPal Here and related
PayPal Retail systems. This application uses external APIs only and thus can be customized and deployed
pretty much anywhere.

** PLEASE NOTE **
For improved performance, these modules should be installed globally to ensure native modules where appropriate:

* [mongoose](http://mongoosejs.com/) ^3.8.15
* connect-mongo ^0.4.0
* [canvas](https://github.com/LearnBoost/node-canvas)
* [pm2](https://github.com/unitech/pm2)
* socket.io ^1.1.0
* mubsub

And then you must set the NODE_DIR environment variable to your global module directory. We do this to enable git deploy
with the same package.json.

The server also requires the following environment variables:

* PAYPAL_APP_ID - The OAuth appId for PayPal, which needs certain scopes enabled (see the code)
* PAYPAL_APP_SECRET - The app secret for the PAYPAL_APP_ID
* PAYPAL_RETURN_URL - The return URL for the app identified by PAYPAL_APP_ID (e.g. https://www.mysite.com/oauth/return)
* NEWRELIC_APP, NEWRELIC_KEY - the app name and key for New Relic monitoring
* MAILGUN_KEY - The MailGun API key for email notifications
* TWILIO_AUTH, TWILIO_SID and TWILIO_NUM - The Twilio API authentication and phone number information

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