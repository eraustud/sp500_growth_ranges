const yearsinput = document.querySelector('#years');
const dollarsinput = document.querySelector('#dollars');
const decile_elements = document.querySelectorAll('#deciles td');
const startyearinput = document.querySelector("#start");

let savedReturns = [];
let defaultReturnsData = [];
let returnsChart;
let sortedReturnsChart;

function makeChart(returns) {
    let returnsdata = returns.map((d) => d.Returns);
    defaultReturnsData = returnsdata.slice();
    const startoffset = Math.max(0, (Number(startyearinput.value) - 1871) * 12);
    returnsdata = returnsdata.slice(startoffset);
    savedReturns = returnsdata;
    const window_size = Math.min(savedReturns.length, Number(yearsinput.value) * 12);
    const average_returns = calculateDistributionOfReturns(returnsdata,window_size);
    const sorted_returns = average_returns.slice().sort((a,b) => a - b);
    let yearlabels = Array.from(new Array(average_returns.length),(e,i)=>i+1);
    yearlabels = yearlabels.map((val) => Math.floor(1871 + (1.0/12) + (startoffset + val)/12));
    console.log(average_returns);
    returnsChart = new Chart('returnsChart', {
        type: 'bar',
        data: {
            labels: yearlabels,
            datasets: [
                {
                    data: average_returns 
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
    sortedReturnsChart = new Chart('sortedReturnsChart', {
        type: 'bar',
        data: {
            labels: yearlabels,
            datasets: [
                {
                    data: sorted_returns 
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });

    const deciles = calculateDeciles(average_returns);
    for (let i = 0; i < deciles.length; i++) {
        decile_elements[i+1].innerHTML = `${deciles[i]}%`;
    }
}

function updateDataDisplay() {
    const window_size = Math.min(savedReturns.length, Number(yearsinput.value) * 12);
    const average_returns = calculateDistributionOfReturns(savedReturns,window_size);
    const sorted_returns = average_returns.slice().sort((a,b) => a - b); 
    const startoffset = Math.max(0, (Number(startyearinput.value) - 1871) * 12);
    let yearlabels = Array.from(new Array(average_returns.length),(e,i)=>i+1);
    yearlabels = yearlabels.map((val) => Math.floor(1871 + (1.0/12) + (startoffset + val)/12));
    returnsChart.data.labels = yearlabels;
    returnsChart.data.datasets[0].data = average_returns;
    returnsChart.update();
    sortedReturnsChart.data.labels = yearlabels;
    sortedReturnsChart.data.datasets[0].data = sorted_returns;
    sortedReturnsChart.update();
    const deciles = calculateDeciles(average_returns);
    for (let i = 0; i < deciles.length; i++) {
        decile_elements[i+1].innerHTML = `${deciles[i]}%`;
    }
}

yearsinput.onchange = (event) => {
    console.log(`input years changed: ${yearsinput.value}`);
    //create an array from 1 to yearsinput.value
    updateDataDisplay();
}

startyearinput.onchange = (event) => {
    console.log(`start year changed: ${startyearinput.value}`);
    const startoffset = Math.max(0, (Number(startyearinput.value) - 1871) * 12);
    savedReturns = defaultReturnsData.slice(startoffset);
    updateDataDisplay();
}

d3.csv('./sp500_returns.csv').then(makeChart);


/**
 * Calculate the array of return values from the array of total price values
 * @param {Array} total_prices
 * @returns {Array} return_values 
 */
function calculateReturns(total_prices) {
    const return_values = [];
    for (let i = 0; i < total_prices.length - 1; i++) {
        return_values.push(total_prices[i+1]/total_prices[i]);
    }
    return_values.push(1); // final return value placeholder represents an instant with no growth
    return return_values;
}

/**
 * Calculate final values of initial investments over an array of return periods
 * NOTE: contributions and returns MUST be the same length
 * @param {Array} contributions
 * @param {Array} returns
 * @returns {Array} final_values
 */
function calculateFinalValues(contributions, returns) {
    // first save all the possible return growths
    const return_products = new Array(returns.length);
    let return_product = 1;
    for (let i = returns.length - 1; i >= 0; i--) {
        return_product *= returns[i];
        return_products[i] = return_product;
    }
    // then save all the contributions based on those cumulative returns
    const final_values = [];
    for (let i = 0; i < contributions.length; i++) {
        final_values[i] = contributions[i]*return_products[i];
    }
    return final_values;
}

/**
 * Calculate normalized weights of investment values based on a series of final values of 
 * the growths of individual contributions in an investment period
 * @param {Array} final_values
 * @returns {Array} weights
 */
function calculateNormalizedWeights(final_values) {
    const weights = new Array(final_values.length);
    const sum_of_values = final_values.reduce((a,b) => a + b);
    for (let i = 0; i < final_values.length; i++) {
        weights[i] = final_values[i]/sum_of_values;
    }
    return weights;
}

/**
 * Calculate the geometric mean of a set of returns
 * @param {Array} weights - An array of weights
 * @param {Array} returns - An array of returns
 * @returns {number} The geometric mean of the returns
 * @example
 * const weights = [0.5, 0.5];
 * const returns = [0.1, 0.2];
 * const geoMean = geoMeanReturns(weights, returns);
 * console.log(geoMean); 
 */
function geoMeanReturns(weights, returns) {
    if (weights.length !== returns.length) {
        console.error("Weights and Returns have mismatched lengths");
        throw new Error("weights and Returns have mismatched lengths");
    }
    let sum_of_weighted_returns = 0;
    for (let i = 0; i < weights.length; i++) {
        sum_of_weighted_returns += Math.log(returns[i])*weights[i];
    }
    return Math.exp(sum_of_weighted_returns)
}

/**
 * Calculate the weighted geometric mean of the returns on contributions over a given period of time
 * @param {Array} contributions contributions for each of the investment periods in the given time window
 * @param {Array} real_total_values real value of the discrete growth of the market per investment period in the given time window
 * @returns {number} average_return
 */
function calculateReturnForWindow(real_total_values, contributions) {
    if (!contributions) {
        contributions = real_total_values.map((_) => 1);
    }
    if (contributions.length !== real_total_values.length) {
        console.error("Contributions and Total Value arrays do not have matching lengths");
        throw new Error("Contributions and Total Value arrays do not have matching lengths");
    }
    const returns = calculateReturns(real_total_values);
    const final_values = calculateFinalValues(contributions, returns);
    const weights = calculateNormalizedWeights(final_values);
    const average_return = geoMeanReturns(weights, returns);
    return average_return;
}

/**
 * Calculate the distribution of all possible return values given a window size over a total set of data
 * @param {Array} window_size
 * @param {Array} real_total_values
 * @return {Array} return_values
 */
function calculateDistributionOfReturns(real_total_values, window_size) {
    const return_values = new Array(real_total_values.length - window_size + 1);
    if (!window_size) {
        window_size = real_total_values.length;
    }
    // slide the window across the array of historical data
    for (let i = 0; i < return_values.length; i++) {
       return_values[i] = (Math.pow(calculateReturnForWindow(real_total_values.slice(i, i + 1 + window_size)),12) - 1) * 100; // return %
    }
    return return_values;
}


/**
 * Calculate min, decile, and max statistics of table value ranges
 * @param {Array} historical_returns
 * @returns {Array} return_stats
 */
function calculateDeciles(historical_returns) {
    const return_stats = new Array(11);
    const returns_sorted = historical_returns.slice().sort((a,b) => a - b);
    for (let i = 0; i <= 100; i += 10) {
        return_stats[Math.floor(i/10)] = returns_sorted[Math.min(Math.round(i * returns_sorted.length / 100),returns_sorted.length -1)].toFixed(3);
    }
    return return_stats;
}