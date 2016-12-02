
/**
 *  Graphical Tension Visualizer. Circles
 *
 *  Coded by Andrew Shapiro
 *  in collaboration with Igor Shtang
 *
 *  Controls:
 *  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *  c           clear screen
 *  space       launch/stop simulation
 *  click       add an object with random size
 *  drag        moves object
 *  shift+drag  changes object size
 *  ↓           trigger result forces visibility, red-arrowed
 *  ↑           trigger tension field visibility
 *  ←           trigger frame visibility
 *  →           trigger displacement direction visibility
 *  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 */

var GAP = 40; // margin for initial points
var MIN_SIZE = 40; // object minimum size
var MAX_SIZE = 40; // object maximum size
var CAPACITANCE = 15; // electrical charge capacity, 'electro viscocity'
var DRAG_AMOUNT = 1; //  scale factor of dragging for mass scale
var FORCE_SCALE = 130; // forces lines multiplicator
var FIELD_SCALE = 20; // tension field lines multiplicator
var TENSION_FIELD_STEP = 5;

// frame particles characteristics
var cornerWeight = 0;  // weights in corners
var borderStep = MIN_SIZE;   // distance between frame particles
var borderWeight = MIN_SIZE; //w * h / ((w + h)/borderStep); // weights on frame

var w = 600; // simulation window width
var h = 300; // height
var frameAspectRatio = 16/9;

var pickedObjectIndex = -1; // buffer for clicked object index
var maxIntensityMemory = 0.2;
var adaptiveTensionFieldStep = TENSION_FIELD_STEP;
var adaptiveTensionFieldDirection = 1;
var isTensionFieldAdaptive = false;
var isScaling = false; // flag of object scaling while drug-n-drop
var isDeleting = false; // flag of object deleting
var isMoving = false; // flag of object moving

var showTension = true; // map tension on particles on colors
var showField = false; // field picture
var showDisplacements = false; // displacemens lines
var showResultForces = false; // resulrint Forces-arrows
var showFrame = false;
var showHeatmap = false; // map tension on particles on colors
var isFramed = true; // mass-electric constraints on frame boundary
var isSimulating = false; // animation trigger
var wasAutoSwitched = true;

var objects =  new Array();
var obstacles =  new Array();
var objects_all =  new Array();
var delta = new Array();
var heatmapData = new Array();
var simpleheatInstance = null;

//p5.disableFriendlyErrors = true;

function setup() {

	var canvasSize = getCanvasSize();
	var canvas = createCanvas(canvasSize[0], canvasSize[1]);
	simpleheatInstance = simpleheat(canvas.canvas);
	simpleheatInstance.radius(15, 15);
	// simpleheatInstance.gradient({0.1: 'blue', 1000000.0: 'lime', 52791746.0: 'red'})

	// setup an interaction inside simulator canvas
	canvas.mousePressed(function() {
		if (objects.length != 0) {
			var sample = getNearest(mouseX, mouseY);
			pickedObjectIndex = sample[0];
			var minDistance = sample[1];
			if (pickedObjectIndex < 0) return;
			if (isDeleting) {
				objects.splice(pickedObjectIndex, 1);
				objects_all.splice(pickedObjectIndex, 1);
				return;
			}
			var objectSize = objects[pickedObjectIndex][2]/2;
			if (minDistance < objectSize) return;
		}

		var newSize = random(MIN_SIZE, MAX_SIZE);
		objects.push([mouseX, mouseY, newSize]);
		pickedObjectIndex = -1;

		return false; // prevent default
	});

	canvas.mouseReleased(function() {
		pickedObjectIndex = -1;
		scaleSign = 0;
		isMoving = false;
		return false; // prevent default
	});

	populateInitially()

	// Move the canvas so it's inside our <div id="sketch-holder">.
	canvas.parent('sketch-holder');

}


function draw() {

	background(225);
	controlAnimation();

	var realObjectsNumber = objects.length;
	objects_all = objects.concat(obstacles);
	var delta = calculateDisplacements(objects_all);

	simulateMotion(delta);
	drawTensionFieldHeatmap();
	drawTensionField();
	drawParticles(delta);
	drawFrame();
	drawCursor();
	drawFPS();
	drawInstruction();
}

function populateInitially() {
	// initiate with objects
	objects.push([GAP, GAP, MIN_SIZE]);
	objects.push([GAP, height - GAP, MIN_SIZE]);
	objects.push([width - GAP, height - GAP, MIN_SIZE]);
	objects.push([width - GAP, GAP, MIN_SIZE]);

	if (isFramed) {
		// horizontal frame part
		for (var x = 0; x <= width; x += borderStep) {
		  obstacles.push([x, 0, borderWeight]);
		  obstacles.push([x, height, borderWeight]);
		}

		// vertical frame part
		for (var y = 0; y <= height; y += borderStep) {
		  obstacles.push([0, y, borderWeight]);
		  obstacles.push([width, y, borderWeight]);
		}

		// concentrators in the corners
		obstacles.push([0, 0, cornerWeight]);
		obstacles.push([width - cornerWeight, height - cornerWeight, cornerWeight]);
		obstacles.push([width - cornerWeight, 0, cornerWeight]);
		obstacles.push([0, height - cornerWeight, cornerWeight]);
	}
}


function getCanvasSize() {
	w = $('#sketch-holder').width();

	var shift = w % MIN_SIZE;
	$('#controls').css('padding-right', Math.round(shift) + 'px');

	w = w - shift;
	h = w / frameAspectRatio;
	h = h - h % MIN_SIZE;
	return [w, h];
}


function windowResized() {
	var canvasSize = getCanvasSize();
	resizeCanvas(canvasSize[0], canvasSize[1]);
	objects = [];
	obstacles = [];
	populateInitially();
}


function controlAnimation() {
	if ($('#simulator').visible(true)) {
		if (isSimulating || !wasAutoSwitched) return;
		isSimulating = true;
	} else {
		wasAutoSwitched = true;
		isSimulating = false;
	}
	renderSimulationTrigger();
}


function simulateMotion(delta) {
	if (!isSimulating) {
		return;
	}
	var realObjectsNumber = objects.length;
	for (var i = 0; i < realObjectsNumber; i++) {
		objects[i][0] += correctShift(delta[i][0]); // simulate: add displacements to coords
		objects[i][1] += correctShift(delta[i][1]);
	}
}


function calculateDisplacements(objectsArray) {
	// TODO: optimize. no need to calulate it when simulation is stopped
	var delta = new Array();
	var realObjectsNumber = objects.length;

	stroke(0, 0, 255);
	strokeWeight(0.25);

	for (var i = 0; i < realObjectsNumber; i++) {
		delta.push([0, 0]);
	}
	for (var i = 0; i < realObjectsNumber; i++) {
		for (var j = 0; j < objectsArray.length; j++) {
		    if (i == j) continue;
		    var _delta = calculateDeltaByIndex(j, i, objectsArray);
		    delta[i][0] += _delta[0];
		    delta[i][1] += _delta[1];

		    if (showDisplacements) {
		    	var x1 = objects[i][0];
		    	var x2 = x1 + _delta[0] * FORCE_SCALE;
		    	var y1 = objects[i][1];
		    	var y2 = y1 + _delta[1] * FORCE_SCALE;
		    	drawArrow(x1, y1, x2, y2, 0.5, 2, false);
	    	}
		}
	}
	return delta;
}


function calculateIntensity(x, y) {
	/*
	 * Electical intensity in point with coordinates x, y
	 */
	var _delta = [0, 0];
	for (var k = 0; k < objects_all.length; k++) {
     	var _x = objects_all[k][0];
     	var _y = objects_all[k][1];
     	var squareMass = area(objects_all[k][2]);
     	var __delta = calculateDelta(x, y, _x, _y, squareMass);
     	_delta[0] += __delta[0];
     	_delta[1] += __delta[1];
	}
	return _delta;
}



function drawParticles(delta) {
	var realObjectsNumber = objects.length;
	var mappedColors = [];
	if (showTension) {
		var magnitudes = objects.map(function(obj) {
			var x = obj[0];
			var y = obj[1];
			var val = calculateIntensity(x, y);
			var vec = createVector(val[0], val[1]);
			vec.mult(1/obj[2]);
		 	return vec.mag();
		});
		for (var i = 0; i < realObjectsNumber; i++) {
			var newVal = map(magnitudes[i], 0, maxIntensityMemory, 0, 255);
			mappedColors.push(newVal);
		}
	}
	for (var i = 0; i < realObjectsNumber; i++) {
		fill(0);
		noStroke();
		if (showField) {
			fill(0);
		}
		if (showTension) {
			fill(mappedColors[i], 0, 0);
		}
		if (i == pickedObjectIndex) {
			fill(84, 153, 230);
		}
		ellipse(objects[i][0], objects[i][1], objects[i][2], objects[i][2]);

		if (showResultForces) {
			var x1 = objects[i][0];
			var x2 = x1 + delta[i][0] * FORCE_SCALE;
			var y1 = objects[i][1];
			var y2 = y1 + delta[i][1] * FORCE_SCALE;
			stroke(255, 0, 0);
			fill(255, 0, 0);
			drawArrow(x1, y1, x2, y2, 0.5, 3, true);
		}
	}
}


function drawTensionField() {

	if (!showField) return;

	strokeWeight(0.5);

	if (isTensionFieldAdaptive) {
		if (frameRate() < 30) {
			if (adaptiveTensionFieldDirection > 0) {
				adaptiveTensionFieldStep *= 1.05;
				adaptiveTensionFieldDirection = 1;
			}
		} else if (frameRate() > 60) {
			if (adaptiveTensionFieldDirection < 0) {
				adaptiveTensionFieldStep *= 0.95;
				adaptiveTensionFieldDirection = -1;
			}
		}
	}

 	for (var x = 0; x < width; x += adaptiveTensionFieldStep) {
    	for (var y = 0; y < height; y += adaptiveTensionFieldStep) {
     		var _delta = calculateIntensity(x, y);
    		var vec = createVector(_delta[0], _delta[1]);
    		var vecLength = vec.mag();
    		var thinkness = map(vecLength, 0, 30, 0, 255);
    		stroke(0, thinkness);
    		vec.normalize();
      		line(x, y, x + FIELD_SCALE * vec.x, y + FIELD_SCALE * vec.y);
    	}
	}
}

function quadraticToLinear(value) {
	return Math.pow((value), 0.5)
}

function drawTensionFieldHeatmap() {
	simpleheatInstance.clear()
	if (!showHeatmap) return;
	heatmapMatrix = new Array();
	transformedHeatmapMatrix = new Array();
	maximalValue = 0.001;

 	for (var x = 0; x < width; x += 10) {
    	for (var y = 0; y < height; y += 10) {
     		var _delta = calculateIntensity(x, y);
    		var vec = createVector(_delta[0], _delta[1]);
    		var value = quadraticToLinear(vec.mag());
				transformedHeatmapMatrix.push([x, y, value])
				if(value > maximalValue) {
					maximalValue = value;
				}
    	}
	}

	simpleheatInstance.max(maximalValue);
	simpleheatInstance.data(transformedHeatmapMatrix)
	simpleheatInstance.draw(0.05)
}

function drawFrame() {
	if (showFrame) {
		fill(0);
		noStroke();
		for (item of obstacles) {
		    var halfSize = item[2]/2;
		    var size = item[2];
		    ellipse(item[0], item[1], size, size);
		}
	}
}

function drawFPS() {
  var fps = frameRate();
  fill(0, 80);
  textAlign(LEFT);
  text('FPS: ' + fps.toFixed(0), 10, height - 10);
}

function drawInstruction() {
	fill(0, 80);
	textAlign(RIGHT);
	text('Масштабировать — потащить с шифтом, удалить — альт-клик', width - 10, height - 10);
}
