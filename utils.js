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
    const selectedDates = [];

    for (let i = 0; i < numTimes; i++) {
        let randomDay = start.add(ranInt(delta), 'days').format(dateFormat);
        selectedDates.push(randomDay)

    }

    return {
		delta, selectedDates
	}
}

exports.pullRandomEvents = async function (auth, dates) {
    const opts = {
        method: 'POST',
        url: 'https://mixpanel.com/api/2.0/jql',
        headers: {
            Accept: 'application/json',
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: { script: `` }
    }
    const rawEvents = {};

    for (const day of dates) {
        rawEvents[day] = []
        const query = buildJQL(day);
        opts.data.script = query;
        let res;
        try {
            res = await fetch(opts)
        } catch (e) {
            log(`error calling /jql`)
            log(`${e.message} : ${e.response.statusText}`)
            log(json(e.response.data))
            process.exit(0)
        }

        const events = res.data.map(event => event.value);
        //clean up events
        events.forEach((event) => {
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

    const grouped = _.groupBy(raw, event => event.name);

    //clean up data structure
    let result = {};
    for (let uniqueEventName in grouped) {
        result[uniqueEventName] = {}
        result[uniqueEventName].samples = grouped[uniqueEventName]
        result[uniqueEventName].meta = {};
    }
    return result
}


exports.getAllEvents = async function (auth, start, end) {
    const dateFormat = `YYYY-MM-DD`
    const startDate = dayjs(start).format(dateFormat)
    const endDate = dayjs(end).format(dateFormat)
    let payload = {
        "tracking_props": {
            "is_main_query_for_report": true,
            "report_name": "insights",
            "has_unsaved_changes": true,
            "query_reason": "qb_other_update"
        },
        "bookmark": {
            "sections": {
                "show": [{
                    "dataset": "$mixpanel",
                    "value": {
                        "name": "$all_events",
                        "resourceType": "events"
                    },
                    "resourceType": "events",
                    "profileType": null,
                    "search": "",
                    "dataGroupId": null,
                    "math": "total",
                    "perUserAggregation": null,
                    "property": null
                }],
                "cohorts": [],
                "group": [],
                "filter": [],
                "formula": [],
                "time": [{
                    "dateRangeType": "between",
                    "unit": "day",
                    "value": [startDate, endDate]
                }]
            },
            "columnWidths": {
                "bar": {}
            },
            "displayOptions": {
                "chartType": "bar",
                "plotStyle": "standard",
                "analysis": "linear",
                "value": "absolute"
            },
            "sorting": {
                "bar": {
                    "sortBy": "column",
                    "colSortAttrs": [{
                        "sortBy": "value",
                        "sortOrder": "desc"
                    }]
                },
                "line": {
                    "sortBy": "value",
                    "sortOrder": "desc",
                    "valueField": "averageValue",
                    "colSortAttrs": []
                },
                "table": {
                    "sortBy": "column",
                    "colSortAttrs": [{
                        "sortBy": "label",
                        "sortOrder": "asc"
                    }]
                },
                "insights-metric": {
                    "sortBy": "value",
                    "sortOrder": "desc",
                    "valueField": "totalValue",
                    "colSortAttrs": []
                },
                "pie": {
                    "sortBy": "value",
                    "sortOrder": "desc",
                    "valueField": "totalValue",
                    "colSortAttrs": []
                }
            }
        },
        "queryLimits": {
            "limit": 10000
        },
        "use_query_cache": true,
        "use_query_sampling": false
    }

    const opts = {
        method: 'POST',
        url: 'https://mixpanel.com/api/2.0/insights',
        headers: {
            Accept: 'application/json',
            Authorization: `Basic ${auth}`,

        },
        data: payload
    }

    let resTotal;
    let resSegmented
    try {
        resTotal = await fetch(opts);
        payload.bookmark.sections.group = [{
            "dataset": "$mixpanel",
            "value": "$event_name",
            "resourceType": "events",
            "profileType": null,
            "search": "",
            "dataGroupId": null,
            "propertyType": "string",
            "typeCast": null,
            "unit": null
        }]
        payload.bookmark.liftComparison = { "type": "percentOverall" }
        resSegmented = await fetch(opts)

        return {
            total: resTotal.data.series["All Events - Total"].all,
            segmented: resSegmented.data.lift_comparison.series["All Events - Total"]
        }

    } catch (e) {
        debugger;
        process.exit(0);
    }

}

exports.sizeEvents = function (eventSamples) {
    for (let uniqueEvent in eventSamples) {
        eventSamples[uniqueEvent].meta.sizes = []
        for (let sampleEvent of eventSamples[uniqueEvent].samples) {
            eventSamples[uniqueEvent].meta.sizes.push(calcSize(sampleEvent))
        }

        //calc average for each unique event
        let average = eventSamples[uniqueEvent].meta.sizes.reduce(function (sum, eventSizeInBytes) {
            return sum + parseFloat(eventSizeInBytes);
        }, 0) / eventSamples[uniqueEvent].meta.sizes.length;

        eventSamples[uniqueEvent].meta.avgSize = average
    }

    return eventSamples;
}

exports.joinRawAndSummary = function (raw, calculated, startDate, endDate) {
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    const delta = end.diff(start, 'days');

    const result = {
        total: calculated.total,
        numDays: delta
    }
    const { segmented } = calculated

    for (const uniqueEvent in raw) {
        if (segmented[uniqueEvent]) {
            const percentOfTotal = segmented[uniqueEvent].all;
            const estimateOfTotal = percentOfTotal * calculated.total
            raw[uniqueEvent].meta.percent = percentOfTotal
            raw[uniqueEvent].meta.estimatedTotal = estimateOfTotal
            raw[uniqueEvent].meta.estimatedAggSize = estimateOfTotal * raw[uniqueEvent].meta.avgSize
        }
		
		//hidden events can't be quried in insights
		else {
			const percentOfTotal = `unknown`;
            const estimateOfTotal = `event hidden`
            raw[uniqueEvent].meta.percent = 0
            raw[uniqueEvent].meta.estimatedTotal = estimateOfTotal
            raw[uniqueEvent].meta.estimatedAggSize = 0
		}
    }

    result.raw = raw
    return result

}

exports.buildTable = function (analyzedEvents, summary) {
    const headers = `"eventName","numSamples","numDays","avgSize","percentOfVolume","estimatedVolume","estimatedSize"`;
    let body = ``
    let table = []
    let columns = headers.split(',').map(header => header.replaceAll('"', ''));
    let { raw } = analyzedEvents
    for (const event in raw) {
        const e = raw[event]
        const row = `"${event}","${e.samples.length}","${smartCommas(analyzedEvents.numDays)}","${exports.bytesHuman(roundAccurately(e.meta.avgSize))}","${roundAccurately(e.meta.percent * 100, 2)}%","${smartCommas(roundAccurately(e.meta.estimatedTotal))}","${exports.bytesHuman(e.meta.estimatedAggSize)}"`
        body += row
        body += "\n"
        const tableRowData = row.split(',"').map(row => row.replaceAll('"', ''));
        let tableRowSummary = {};
        for (const [index, value] of tableRowData.entries()) {
            tableRowSummary[columns[index]] = value
        }
        table.push(tableRowSummary)
    }

	let totalTable = {
		eventName: "TOTALS",
		numSamples: `---`,
		avgSize : `---`,
		numDays : analyzedEvents.numDays.toString(),
		percentOfVolume: `100%`,
		estimatedVolume: smartCommas(summary.totalEvents),
		estimatedSize: exports.bytesHuman(summary.estimatedSizeOnDisk)
	}

	body += `\n"${totalTable.eventName}","${totalTable.numSamples}","${smartCommas(analyzedEvents.numDays)}","${totalTable.avgSize}","${totalTable.percentOfVolume}","${totalTable.estimatedVolume}","${totalTable.estimatedSize}\n`
	table.push(totalTable)

    body = body.trim()

    let csv = headers.concat("\n", body)

    return {
        csv,
        table,
        columns
    }



}

//https://stackoverflow.com/a/14919494
exports.bytesHuman = function (bytes, si = false, dp = 2) {
    const thresh = si ? 1000 : 1024;

    if (Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }

    const units = si ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let u = -1;
    const r = 10 ** dp;

    do {
        bytes /= thresh;
        ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);


    return bytes.toFixed(dp) + ' ' + units[u];
}


//helper to open the finder
exports.openExplorerinMac = function(path, callback) {
	path = path || '/';
	let p = spawn('open', [path]);
	p.on('error', (err) => {
		p.kill();
		return callback(err);
	});
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

//caculates size in bytes; assumes utf-8 encoding: https://stackoverflow.com/a/63805778 
function calcSize(event) {
    return Buffer.byteLength(JSON.stringify(event))
}

function smartCommas(x) {
    try {
	return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	}
	catch(e) {
		return x
	}
}

exports.smartCommas = smartCommas

//https://gist.github.com/djD-REK/068cba3d430cf7abfddfd32a5d7903c3
function roundAccurately(number, decimalPlaces = 0) {
    return Number(Math.round(number + "e" + decimalPlaces) + "e-" + decimalPlaces)
}