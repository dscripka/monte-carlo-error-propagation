// Get user-typed equation from input box, and generate appropriate number of toggle-buttons for variable property definitions

// Create global variables
var f = '';
var variables = [];
var varVals = {};
var N = 5000  //number of iterations to perform for monte carlo distribution

// Define equation definition event (i.e., "enter" after defining equation)
$('input#equationInput').on('keyup', function (e) {
	e.preventDefault()
	if (e.keyCode === 13) {
		processEq()
	};
});

$('#processEq').click(function() {
	processEq()
});

$('#resetEq').click( function () {
	$('#equationInput').val('');
	$('#accordion').html('');
	$('#finalCalculation').addClass('hidden');
	$('#eqPrev').attr("src", '');
	$('#myDiv').html('');
	$('#resultsDiv').addClass('hidden');
});

// Update plot and distribution values when new parameters are entered

$(document).on('click', 'a[id*="updateParameter"]', function () {
	$('input#variable-'+this.id.split('-')[1]+'-uniform, .active').prop('checked', true);	//this needs to be here, otherwise update button doesn't work?
	updatePlot(this.id.split('-')[1]);
});

// Trigger updates of individual plots and options based on variable viewing changes
$(document).on('change', 'input, .form-control', function(event) {
	//console.log(this.id.split('-')[1]);
	updatePlot(this.id.split('-')[1])
});

$(document).on('click', 'a[href*="collapse-"]', function () {
	updatePlot(this.href.slice(-1));
});

///////////////////////////////////
// Functions
///////////////////////////////////

// Process initial equation and assign default distributions to variables

function processEq () {
		// Get equation text
		var equationText = $('#equationInput').val();

		// Preview equation in LaTeX
		var LaTeX = nerdamer(equationText).toTeX();
		$('#eqPrev').attr("src", 'http://latex.codecogs.com/svg.latex?'+LaTeX);

		// Remove protected strings (i.e., math functions)
		var protectedStrings = "cos, sin, tan, sec, csc, cot, acos, asin, atan, exp, min, max, erf, floor, ceil, fact, round, mod, vector, matrix, parens, sqrt, log, abs, invert, transpose, dot, diff, differentiate, sum, proots, factor, expand, polyGCD, determinant, step, sign, rect, sinc, tri".split(', ')
		
		$.each(protectedStrings, function (index,value) {
			equationText = equationText.replace(value, '');
		});

		//console.log(equationText);
		variables = equationText.replace(/[^a-zA-Z]+/g, '').split('');
		variables = Array.from(new Set(variables));

		// Build function, with variables in order of appearance
		f = nerdamer(equationText).buildFunction(variables);

		// Create new expandable sections for variables (in the order they appear)

		$.each(variables, function (index, value) {
			//Create layout of each accordian region with mustache.js templating
			$.get('variableTemplate.html', function(template) {
				var rendered = Mustache.render(template, {var: value.toString()});
				//console.log(rendered);
				$('#accordion').append(rendered);

				// Input default values for default uniform distribution
				$('#variable-' + value + '-par1').val(0)
				$('#variable-' + value + '-par2').val(1)

				// Get and store initial monte carlo distribution
				varVals[value] = {};
				varVals[value]['distribution'] = 'uniform'
				varVals[value]['monteCarloValues'] = getRandomValues('uniform', 0, 1, 10000)
				varVals[value]['par1'] = 0;
				varVals[value]['par2'] = 1;

				// Create variable plot
				updatePlot(value);
				

				// Show final calculation button
				$('#finalCalculation').removeClass('hidden');
			});
		});


};

// Define function for final calculation of monte carlo uncertainty statistics

$("#finalCalculation").click( function() {

	// Show results
	$('#resultsDiv').removeClass('hidden');

	//Update values in main storage object
	updateVals();

	// Create final storage vector for overall distribution
	mcDistribution = [];

	//Get values for individual variables
	var i = 0;
	while (i < N) {
		var args = [];
		$.each(variables, function (index, value) {
			args.push(varVals[value]['monteCarloValues'][i])
		});
		mcDistribution.push(f.apply(this, args));
	i++;
	}

	// Get empirical distribution parameters and insert into results table

	var mcMean = math.mean(mcDistribution);
	var mcSD = math.std(mcDistribution);
	var mcConfIntLower = math.quantileSeq(mcDistribution, 0.025);
	var mcConfIntUpper = math.quantileSeq(mcDistribution, 0.975);

	$('#tableMean').html(mcMean.toPrecision(3));
	$('#tableSD').html(mcSD.toPrecision(3));
	$('#tableConfInt').html(mcConfIntLower.toPrecision(3) + ' to ' + mcConfIntUpper.toPrecision(3));

	//// Calculate approximate proportion of error assigned to each variable

	// Get partial derivatives

/*	$.each(variables, function (index, value) {
		var eqText = $('#equationInput').val();
		var deriv = nerdamer("'diff(" + eqText +", " + value + +"')");
	});*/


	// Create plot.ly plots of final monte carlo distribution

	var data = [
				{
					x: mcDistribution,
					type: 'histogram',
					nbinsx: 100,
					marker: {
					color: 'rgba(100,250,100,0.7)',
					},
				}
				
				];

	var layout = {
					autosize: true,
					margin: {
						t: 5,
						},
					xaxis: {title: 'Value'},
					yaxis: {title: 'Counts'},
					shapes: [
								{
									type: 'rect',
									xref: 'x',
									yref: 'paper',
									x0: mcConfIntLower,
									y0: 0,
									x1: mcConfIntUpper,
									y1: 1,
									fillcolor: '#d3d3d3',
									opacity: 0.3,
									line: {
										width: 0
									},
								},
								{
									type: 'line',
									xref: 'x',
									yref: 'paper',
									x0: mcMean,
									y0: 0,
									x1: mcMean,
									y1: 1,
									line: {
										color: 'rgb(55, 128, 191)',
										width: 3
									}
								},
					]
				 };

	// Add the plot to the page
	Plotly.newPlot('myDiv', data, layout);

	// Display the parameters of the empirical distribution
	$('#distribution-parameters');
});

// Define function to calculate random variables (calculates n=1000 samples by default)

function getRandomValues(distType, par1, par2, n=N) {

	// Get text values and convert to floats
	par1 = parseFloat(par1);
	par2 = parseFloat(par2);
	var values = [];
	if (distType == "normal") {
		var mean = par1;
		var stdev = par2;
	}

	// Use the cryptographically secure random number generator to get a uniform distribution between 0 and 1 (inclusive on both ends)
	function cryptoUniformRandom() {
    	return window.crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000;
	}

	// Generate random numbers from desired distribution
	
	if (distType == "uniform") {
		for (i = 0; i <= n; i++) {
			values.push(cryptoUniformRandom()*(par2 - par1) + par1);
		}
	}

	else if (distType == "triangular") {
		for (i = 0; i <= n; i++) {
			var a = cryptoUniformRandom() * (par2/2 - par1/2) + par1/2;
			var b = cryptoUniformRandom() * (par2/2 - par1/2) + par1/2;
			values.push((a-b) + par1 + (par2-par1)/2.0) // not correct for lower == 0? Also, not correct in general?
		}
	}

	else if (distType == "normal") {
		for (i = 0; i <= n; i++) {
			// Get normal variates with mean = center and standard deviation 1
			var u = 1.0 - cryptoUniformRandom(); // Subtraction to flip [0, 1) to (0, 1].
   			var v = 1.0 - cryptoUniformRandom();
				var normalVal = stdev * Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v ) + mean;
			values.push(normalVal)
		}
	}

	//return final values

	return(values);
};

// percentile function

function percentile(arr, p) {
			if (arr.length === 0) return 0;
			if (typeof p !== 'number') throw new TypeError('p must be a number');
			if (p <= 0) return arr[0];
			if (p >= 1) return arr[arr.length - 1];

			var index = arr.length * p,
				lower = Math.floor(index),
				upper = lower + 1,
				weight = index % 1;

			if (upper >= arr.length) return arr[lower];
			return arr[lower] * (1 - weight) + arr[upper] * weight;
		};

// Update plot.ly plot function

function updatePlot(value){

	// Update global values for all plots
	updateVals();
	// Create updated plot for current variable
	var data = [
				{
					x: varVals[value]["monteCarloValues"],
					type: 'histogram',
					nbinsx: 100,
					marker: {
					color: 'rgba(100,250,100,0.7)',
					},
				}
				];

	var layout = {
					autosize: true,
					height: 200,
					margin: {
						l: 35,
						r: 35,
						b: 20,
						t: 20,
						pad: 2
						}
				};

	Plotly.newPlot('variable-'+ value +'-plot', data, layout);
};

// Get values for all variables

function updateVals(){
	//Get values for individual variables
	$.each(variables, function (index, value) {

		// Set distribution type and parameters

		if ($('input#variable-'+value+'-normal').prop('checked')) {
			varVals[value]["distribution"] = "normal";

			// Change inputs labels for normal distribution
			$("label[for=variable-"+value+"-par1]").html("Mean");
			$("label[for=variable-"+value+"-par2]").html("Standard Deviation");

			// Set values
			varVals[value]["par1"] = $('#' + 'variable-' + value + '-par1').val()
			varVals[value]["par2"] = $('#' + 'variable-' + value+ '-par2').val()

			// Generate the appropriate random numbers for each variable
			varVals[value]["monteCarloValues"] = getRandomValues(varVals[value]["distribution"], varVals[value]["par1"], varVals[value]["par2"]);

			console.log("test");

		};

		if ($('input#variable-'+value+'-triangular').prop('checked')) {
			varVals[value]["distribution"] = "triangular";

			// Change inputs labels for triangular distribution
			$("label[for=variable-"+value+"-par1]").html("Lower Bound");
			$("label[for=variable-"+value+"-par2]").html("Upper Bound");

			// Set values
			varVals[value]["par1"] = $('#' + 'variable-' + value + '-par1').val()
			varVals[value]["par2"] = $('#' + 'variable-' + value + '-par2').val()

			// Generate the appropriate random numbers for each variable
			varVals[value]["monteCarloValues"] = getRandomValues(varVals[value]["distribution"], varVals[value]["par1"], varVals[value]["par2"]);

		};


		if ($('input#variable-'+value+'-uniform').prop('checked')) {
			varVals[value]["distribution"] = "uniform";

			// Change inputs labels for uniform distribution
			$("label[for=variable-"+value+"-par1]").html("Lower Bound");
			$("label[for=variable-"+value+"-par2]").html("Upper Bound");

			// Set values
			varVals[value]["par1"] = $('#' + 'variable-' + value + '-par1').val()
			varVals[value]["par2"] = $('#' + 'variable-' + value + '-par2').val()

			// Generate the appropriate random numbers for each variable
			varVals[value]["monteCarloValues"] = getRandomValues(varVals[value]["distribution"], varVals[value]["par1"], varVals[value]["par2"]);

		};
	});
};