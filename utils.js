const Chance = require('chance')
const chance = new Chance()
const _ = require('underscore')
const dayjs = require('dayjs')
const dateFormat = `YYYY-MM-DD`
const fetch = require('axios').default
const { log } = require('./logger.js')



//exported utils
exports.getRandomDaysBetween = function (startDate, endDate, numTimes) {
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    const delta = end.diff(start, 'days');
    const results = [];

    for (let i = 0; i < numTimes; i++) {
        let randomDay = start.add(ranInt(delta), 'days').format(dateFormat);
        results.push(randomDay)

    }

    return results
}

exports.pullRandomEvents = async function (apiSecret, dates) {
    const auth = Buffer.from(apiSecret + '::').toString('base64');
    const opts = {
        method: 'POST',
        url: 'https://mixpanel.com/api/2.0/jql',
        headers: {
            Accept: 'application/json',
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: { script: ``}
    }
    const rawEvents = {};

    for (const day of dates) {
		rawEvents[day] = []
        const query = buildJQL(day);
		opts.data.script = query;
        
		try {
			const res = await fetch(opts)
		}
		catch (e) {
			log(`error calling /jql`)
			log(`${e.message} : ${e.response.statusText}`)
			log(json(e.response.data))
			process.exit(0)
		}
		
		const events = res.data.map(event => event.value);
		//clean up events
		events.forEach((event)=>{
			event.properties.time = event.time
			event.properties.distinct_id = event.distinct_id
			delete event.dataset
			delete event.distinct_id
			delete event.labels
			delete event.sampling_factor
			delete event.time
			delete event.properties.$import
			delete event.properties.$mp_api_endpoint
			delete event.properties.$mp_api_timestamp_ms
			delete event.properties.mp_processing_time_ms
		})		
		rawEvents[day].push(events)		
    }

	return rawEvents;

}


exports.groupRaw = function (dailyIterations) {
	let raw = [];
	for (let day in dailyIterations) {
		raw = [...raw, ...dailyIterations[day]]
	}

	raw = raw.flat();

	const grouped = _.groupBy(raw, event => event.name)

	
	debugger;
}




//local utils
function ranInt(ceil) {
    if (ceil > 0) {
        return chance.integer({ min: 0, max: ceil })
    } else {
        return 0
    }
}


function buildJQL(date) {
    return `function main() {
		return Events({
		  from_date: '${date}',
		  to_date:   '${date}'
		})
		.groupBy(["name"], mixpanel.reducer.any());
	  }`

}


function json(data) {
	return JSON.stringify(data, null, 2)
}