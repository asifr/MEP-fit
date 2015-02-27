/*
 * Use optimization to estimate best fit parameters
 * Equation: Bottom + (Top - Bottom) / (1 + exp(-(S50-S) / k))
 */

// Optimization params
var n=4; // number of variables
var m=0; // number of constraints

// Various Cobyla constants, see Cobyla docs in Cobyja.js
var rhobeg = 5.0;
var rhoend = 1.0e-6;
var iprint = 0;
var maxfun = 10000;

// Global data variables
var Params=new Array(n);
var Yhat=Array();

function sum (x) {
	var sum = 0;
	for (var i = x.length - 1; i >= 0; i--) {
		sum += x[i];
	};
	return sum;
}

function sumprod (x,y) {
	var sum = 0;
	for (var i = x.length - 1; i >= 0; i--) {
		sum += x[i]*y[i];
	};
	return sum;
}

function rsquared (x,y) {
	xs = sum(x);
	ys = sum(y);
	xys = sumprod(x,y);
	x2s = sumprod(x,x);
	y2s = sumprod(y,y);
	N = x.length;

	R2 = ((N*xys-xs*ys)*(N*xys-xs*ys))/((N*x2s-xs*xs)*(N*y2s-ys*ys));
	return R2;
}

function threshold (params, y) {
	console.log(y-params[0]);
	var th = params[2] - params[3]*Math.log(((params[1]-params[0])/(y-params[0])) - 1);
	return Math.round(th * 10000) / 10000;
}

// Root mean square
function rms(residual) {
	var sum_of_squares = residual.reduce(function(s,x) {return (s + x*x)}, 0);
	return Math.sqrt(sum_of_squares / residual.length);
}
// Unconstrained optimization
function objectiveFunction(n,m,x,con) {
	residual = new Array(Data.length);
	for (var i = 0; i < Data.length; i++) {
		if (Data[i][0] != null && Data[i][1] != null && isNumber(Data[i][0]) && isNumber(Data[i][1])) {
			Yhat[i]=x[0] + (x[1] - x[0]) / (1 + Math.exp((x[2]-Data[i][0]) / (1/x[3])));
			residual[i] = Yhat[i]-Data[i][1];
		};
	};
	return rms(residual);
}
function isNumber(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}
function median(ary) {
	if (ary.length == 0)
		return null;
	ary.sort(function (a,b){return a - b})
	var mid = Math.floor(ary.length / 2);
	if ((ary.length % 2) == 1)  // length is odd
		return ary[mid];
	else 
		return (ary[mid - 1] + ary[mid]) / 2;
}
function removeNull (arr) {
	var result = [];
	for (var i = 0; i < arr.length; i++ ) {
		for (var j = 0; j < arr[i].length; j++ ) {
			if (arr[i][j] !== null) {
				if (typeof result[i] == "undefined") {
					result[i] = [];
				};
				 result[i][j] = arr[i][j];
			}
		}
	}
	return result;
}

var app = angular.module('nlinlsmin', ['radian']);

// RegressionController
app.controller("RegressionController",function($scope){
	$scope.sampleData = [
		{
			id: 0,
			name: "Idealized recruitment curve",
			data: [[0,0],[35,0.01], [40,0.01], [45,0.57], [50,0.5], [55,0.9], [60,1.5], [65,2], [70,2.1], [75,1.9], [80,2.3], [85,2.1]]
		}
	];

	$scope.selectedSampleData = 0;
	$scope.Data = [];
	$scope.Params = [];
	$scope.Yhat = [];
	$scope.X = [];
	$scope.Xi = [];
	$scope.Y = [];
	$scope.topMax = 100;
	$scope.rsquared = 0;

	var i=-1; while (i++ < 100) $scope.Xi.push(i);

	$scope.runAnalysis = function(){
		Data = removeNull(ht.getData());

		$scope.X = Data.map(function(value,index) { return value[0]; });
		$scope.Y = Data.map(function(value,index) { return value[1]; });

		// initial guess
		Params[0]=Math.min.apply(null, $scope.Y); // Bottom
		Params[1]=Math.max.apply(null, $scope.Y); // Top
		Params[2]=median($scope.X); // S50
		Params[3]=0.5; // Slope

		Yhat=[]; // reset Yhat
		$scope.Params = FindMinimum(objectiveFunction, n,  m, Params, rhobeg, rhoend,  iprint,  maxfun);
		$scope.Params = $scope.Params.map(function(n){ return Math.round(n * 10000) / 10000; });
		$scope.redrawYhat();
		$scope.topMax = Math.round($scope.Params[1]+10);
		$scope.rsquared = Math.round(rsquared($scope.Y,Yhat) * 10000) / 10000;
		$("#thresholdIntensityValue").html(threshold($scope.Params,parseFloat($("#threshold").val())));
		var val = "bottom,"+$scope.Params[0]+"\ntop,"+$scope.Params[1]+"\nS50,"+$scope.Params[2]+"\nslope,"+$scope.Params[3]+"\nrsquared,"+$scope.rsquared+"\n";
		if ($("#notes").val() == '') {
			$("#notes").val(val).focus();
		} else {
			$("#notes").val(val+"\n----\n\n"+$("#notes").val()).focus();
		};
	};

	$scope.updateUsingSampleData = function(){
		ht.populateFromArray(0,0,$scope.selectedSampleData.data);
	};

	$scope.redrawYhat = function(){
		// $scope.X = new Array();
		// x=[];
		var y=[];
		for (var i = 0; i < 100; i++) {
			// x[i] = i;
			y[i]=$scope.Params[0] + ($scope.Params[1] - $scope.Params[0]) / (1 + Math.exp(($scope.Params[2]-i) / (1/$scope.Params[3])));
		};
		// $scope.Xi=x;
		$scope.Yhat=y;
		// todo: problem updating rsquared because Y and the Yhat calculated here have different lengths
		// $scope.rsquared = Math.round(rsquared($scope.Y,y) * 10000) / 10000;
	};

	$("#threshold").change(function(){
		var th = threshold($scope.Params,parseFloat($(this).val()));
		if (th) {
			$("#thresholdIntensityValue").html(th);
		} else {
			$("#thresholdIntensityValue").html('');
		};
	});
});

// Load the spreadsheet
$("#dataTable").handsontable({
	startRows: 60,
	startCols: 2,
	colHeaders: ["Stimulus intensity (%)","MEP amplitude (mV)"],
	contextMenu: true,
	columns: [{type:"numeric",format:"0,0.00"},{type:"numeric",format:"0,0.00"}],
	afterChange: function(changes, source) {
		if (changes) {
			$("#runButton").removeAttr('disabled');
		};
	}
});
var ht = $("#dataTable").handsontable("getInstance");

$("#menu a").click(function(e){
	e.preventDefault();
	$(".tab").hide();
	$($(this).attr('href')).show();
	$("#menu li.active").removeClass("active");
	$(this).parent().addClass("active");
});

// $("#save").click(function(e){
// 	e.preventDefault();
// 	var data = ht.getData();
// });