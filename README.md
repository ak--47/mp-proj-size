
# mp-proj-size

estimate the size of a mixpanel project... in human readable terms.

## tldr;

define `.env` variables
```bash
echo "API_SECRET=''  #api secret for project
START_DATE='01-01-2022'  #when to start looking for events
END_DATE='08-01-2022'  #when to stop looking for events
ITERATIONS='30'  #60 is the max before you get rate limited" > .env
```

run
```bash
npx mp-proj-size
```
  see:

<img src="https://aktunes.neocities.org/projSize.png" alt="result" />


note:

this script uses **JQL** so it only works on projects in which `/jql` is accessible:

```javascript
function main() {
		return Events({
		  from_date: '${date}',
		  to_date:   '${date}'
		})
		.groupBy(["name"], mixpanel.reducer.any());
	  }
```