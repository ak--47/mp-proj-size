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
const fs = require('fs');
const path = require('path');
const ak = require('ak-tools');
const track = ak.tracker('mp-proj-Size');
const runId = ak.uid(32);

async function main() {
    //gather input from env
    const { API_SECRET, START_DATE, END_DATE, ITERATIONS } = process.env;
    const auth = Buffer.from(API_SECRET + '::').toString('base64');

    //get all the things we need
	track('start', {runId})
    log(`\n👋 ... let's estimate how big your mixpanel project is..\n`)
    const randomDaysToPull = u.getRandomDaysBetween(START_DATE, END_DATE, ITERATIONS);
    log(`	between ${START_DATE} and ${END_DATE}, there are ${randomDaysToPull.delta} days...`)
	log(`	sampling events from ${ITERATIONS} days...`)
    const randomEvents = await u.pullRandomEvents(auth, randomDaysToPull.selectedDates);

    const rawEventsGrouped = u.groupRaw(randomEvents);
    const rawEventsSized = u.sizeEvents(rawEventsGrouped);
    const totalsAndPercents = await u.getAllEvents(auth, START_DATE, END_DATE);
    const combineTotalsAndRaw = u.joinRawAndSummary(rawEventsSized, totalsAndPercents, START_DATE, END_DATE);
    const uniqueEvents = Object.keys(combineTotalsAndRaw.raw);
    const summaries = combineTotalsAndRaw.raw
    log(`	${uniqueEvents.length} unique events exist...`)
	log(`	analyzing ~${ITERATIONS} of each\n`)

    //do analysis	
    const analysis = {
        days: combineTotalsAndRaw.numDays,
        numUniqueEvents: uniqueEvents.length,
        totalEvents: combineTotalsAndRaw.total,
        uniqueEvents,
        estimatedSizeOnDisk: 0
    }
    for (let eventSummary in summaries) {
        analysis.estimatedSizeOnDisk += summaries[eventSummary].meta.estimatedAggSize
    }

    //build a data table to show work
    const dataTable = u.buildTable(combineTotalsAndRaw, analysis);
    log(`here is what i found:`)
    console.table(dataTable.table)

    log(`\nSUMMARY:`, 'p')
    log(`
	over ${analysis.days} days (${START_DATE} - ${END_DATE})
	i found ${analysis.uniqueEvents.length} unique events and ${u.smartCommas(analysis.totalEvents)} total events
	these estimated size on disk is: ${u.bytesHuman(analysis.estimatedSizeOnDisk)} (uncompressed)\n\n`)

	// todo, projections for 6/12/18/24/36 months?
	// log(`\nANALYSIS`, 'p')

    //save a CSV file with the results
    let csvFileName = `./reports/eventSizeAnalysis-${Date.now()}.csv`;
    fs.writeFile(csvFileName, dataTable.csv, 'utf8', function (err) {
        if (err) {
            log('Some error occured - file either not saved or corrupted file saved.', 'e');
			track('error', {type: "file export", runId})
        }
    })
    //todo write to CSV file
    log(`these results have been saved to: ${csvFileName}\n`);
    log(`thank you for playing the game.... 👋 `);
	track('end', {runId})


    //attempt to reveal the data folder in finder
    try {
        u.openExplorerinMac(`./reports/`)
    } catch (e) {
		debugger;
	}



}




//this allows the module to function as a standalone script
if (require.main === module) {
	main(null).then((result) => {
		main();
		// console.log(`RESULTS:\n\n`);
		// console.log(JSON.stringify(result, null, 2));
	});

}