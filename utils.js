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
    return grouped
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

function calcSize(event) {
	//caculates size in bytes: https://stackoverflow.com/a/63805778
	return Buffer.byteLength(JSON.stringify(obj))

}