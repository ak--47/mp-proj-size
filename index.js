#!/usr/bin/env node
/*

THE MIXPANEL PROJECT SIZER
--------------------------------------------
purpose:
    estimate the uncompressed size (on disk) of data inside a mixpanel project
	output a human readable amount of space
	do it, quickly

why:
	size (on disk) matters
	we love to count events, but events come in different shapes and sizes
	it's faster (and easier) to do size estimates on a small subset of data
	mixpanel's APIs (/jql and /segmentation) are pretty good at ... responding to queries

how:
	see README for a detailed methodology, but essentially:
		- pick N random days from a start and end 
		- for each day, ask /JQL for a random instance of each unique event
		- figure out the size of each event; average N instances of the same event
		- weigh those averages against the frequency of each event across all events
		- extrapolate those averages into an estimated size based on total volume
		- print a human readable size (and simple chart)

usage:
    1) configue .env variables (see README)
    2) run this script as:
        npm start
(you need node.js installed)

lovingly made for you by
  ___   _   __
 / _ \ | | / /
/ /_\ \| |/ / 
|  _  ||    \ 
| | | || |\  \
\_| |_/\_| \_/
              
ak@mixpanel.com              

*/






//deps
require('dotenv').config();
const u = require('./utils');
const { log } = require('./logger.js')

async function main() {
	//gather input from env
	const { API_SECRET, START_DATE, END_DATE, ITERATIONS } = process.env;
	const auth = Buffer.from(API_SECRET + '::').toString('base64');
	
	//get all the things we need
	const randomDaysToPull = u.getRandomDaysBetween(START_DATE, END_DATE, ITERATIONS);
	const randomEvents = await u.pullRandomEvents(auth, randomDaysToPull);
	const rawEventsGrouped = u.groupRaw(randomEvents);
	const totalsAndPercents = await u.getAllEvents(auth, START_DATE, END_DATE)
	

	//do analysis
	
	debugger;


}


main();