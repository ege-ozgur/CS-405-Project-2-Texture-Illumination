/**
 * @Instructions
 * 		@task1 : Complete the setTexture function to handle non power of 2 sized textures
 * 		@task2 : Implement the lighting by modifying the fragment shader, constructor,
 *      @task3: 
 *      @task4: 
 * 		setMesh, draw, setAmbientLight, setSpecularLight and enableLighting functions 
 */


function GetModelViewProjection(projectionMatrix, translationX, translationY, translationZ, rotationX, rotationY) {
	
	var trans1 = [
		1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		translationX, translationY, translationZ, 1
	];
	var rotatXCos = Math.cos(rotationX);
	var rotatXSin = Math.sin(rotationX);

	var rotatYCos = Math.cos(rotationY);
	var rotatYSin = Math.sin(rotationY);

	var rotatx = [
		1, 0, 0, 0,
		0, rotatXCos, -rotatXSin, 0,
		0, rotatXSin, rotatXCos, 0,
		0, 0, 0, 1
	]

	var rotaty = [
		rotatYCos, 0, -rotatYSin, 0,
		0, 1, 0, 0,
		rotatYSin, 0, rotatYCos, 0,
		0, 0, 0, 1
	]

	var test1 = MatrixMult(rotaty, rotatx);
	var test2 = MatrixMult(trans1, test1);
	var mvp = MatrixMult(projectionMatrix, test2);

	return mvp;
}


class MeshDrawer {
	// The constructor is a good place for taking care of the necessary initializations.
	constructor() {
		this.prog = InitShaderProgram(meshVS, meshFS);
        this.mvpLoc = gl.getUniformLocation(this.prog, 'mvp');
        this.showTexLoc = gl.getUniformLocation(this.prog, 'showTex');
        this.colorLoc = gl.getUniformLocation(this.prog, 'color');

        this.vertPosLoc = gl.getAttribLocation(this.prog, 'pos');
        this.texCoordLoc = gl.getAttribLocation(this.prog, 'texCoord');

        this.vertbuffer = gl.createBuffer();
        this.texbuffer = gl.createBuffer();

        this.numTriangles = 0;

        // Task 2: Initialize the required variables for lighting
        this.lightPosLoc = gl.getUniformLocation(this.prog, 'lightPos');
        this.ambientLoc = gl.getUniformLocation(this.prog, 'ambient');
        this.enableLightingLoc = gl.getUniformLocation(this.prog, 'enableLighting');
        this.normalLoc = gl.getAttribLocation(this.prog, 'normal');

        // Initialize specular lighting variables
        this.specularIntensityLoc = gl.getUniformLocation(this.prog, 'specularIntensity');
        this.shininessLoc = gl.getUniformLocation(this.prog, 'shininess');
        this.specularIntensity = 1.0; 
        this.shininess = 8.0;         

		this.textures = []; 

        this.maxTextures = 8; 

		for (let i = 0; i < this.maxTextures; i++) {
            const samplerName = `tex${i+1}`;
            const samplerLoc = gl.getUniformLocation(this.prog, samplerName);
            if (samplerLoc === null) {
                console.warn(`Sampler ${samplerName} not found in shader.`);
            }
            this.textures.push({
                texture: null,
                samplerLoc: samplerLoc,
                loaded: false
            });
        }

		this.blendTexturesLoc = gl.getUniformLocation(this.prog, 'blendTextures');

		if (
            this.mvpLoc === null || this.showTexLoc === null || this.colorLoc === null ||
            this.lightPosLoc === null || this.ambientLoc === null || this.enableLightingLoc === null ||
            this.vertPosLoc === -1 || this.texCoordLoc === -1 || this.normalLoc === -1 ||
            this.specularIntensityLoc === null || this.shininessLoc === null
        ) {
            console.error('Failed to get the storage location of an attribute or uniform variable');
        }

		this.lightingEnabled = false;
        this.ambientValue = 0.1;
		
        this.blendTextures = false;;

		// Task 3: Initialize specular lighting variables
		this.specularIntensityLoc = gl.getUniformLocation(this.prog, 'specularIntensity');
		this.shininessLoc = gl.getUniformLocation(this.prog, 'shininess');
		this.specularIntensity = 1.0; 
    	this.shininess = 8.0;        

		//Task4
		this.texture1 = null; // First texture
        this.texture2 = null; // Second texture
        this.texture1Loaded = false;
        this.texture2Loaded = false;

        // Sampler uniforms
        this.tex1Loc = gl.getUniformLocation(this.prog, 'tex1');
        this.tex2Loc = gl.getUniformLocation(this.prog, 'tex2');
        this.blendTexturesLoc = gl.getUniformLocation(this.prog, 'blendTextures');

        // Check if new uniforms are valid
        if (this.tex1Loc === -1 || this.tex2Loc === -1 || this.blendTexturesLoc === -1) {
            console.error('Failed to get the storage location of texture samplers or blend uniform');
        }

        // Control blending
        this.blendTextures = false;
    
	}

	setMesh(vertPos, texCoords, normalCoords) {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertbuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertPos), gl.STATIC_DRAW);

		// Update texture coordinates
		gl.bindBuffer(gl.ARRAY_BUFFER, this.texbuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

		this.numTriangles = vertPos.length / 3;

		// Task 2: Handle normals for lighting
		if (!normalCoords || normalCoords.length === 0) {
			// Generate default normals if none provided
			normalCoords = [];
			for (let i = 0; i < vertPos.length; i += 3) {
				normalCoords.push(0, 0, 1); // Default normal pointing in Z direction
			}
		}

		this.normalBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalCoords), gl.STATIC_DRAW);
	}

	// This method is called to draw the triangular mesh.
	// The argument is the transformation matrix, the same matrix returned
	// by the GetModelViewProjection function above.
	draw(trans) {
		gl.useProgram(this.prog);
	
		gl.uniformMatrix4fv(this.mvpLoc, false, trans);
	
		// Update light position before setting uniforms
		updateLightPos();
	
		// Set the color uniform (e.g., white)
		gl.uniform3f(this.colorLoc, 1.0, 1.0, 1.0);
	
		// Bind textures
		if (this.texture1Loaded) {
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.texture1);
			gl.uniform1i(this.tex1Loc, 0); // Texture unit 0
		}
	
		if (this.texture2Loaded && this.blendTextures) {
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, this.texture2);
			gl.uniform1i(this.tex2Loc, 1); // Texture unit 1
		}
	
		// Set blending uniform
		gl.uniform1i(this.blendTexturesLoc, this.blendTextures ? 1 : 0);
	
		// Pass lighting uniforms
		gl.uniform1f(this.ambientLoc, this.ambientValue || 0.1);
		gl.uniform1i(this.enableLightingLoc, this.lightingEnabled);
		gl.uniform3f(this.lightPosLoc, lightX, lightY, lightZ);
	
		// Pass specular lighting uniforms
		gl.uniform1f(this.specularIntensityLoc, this.specularIntensity);
		gl.uniform1f(this.shininessLoc, this.shininess);
	
		// Bind vertex position buffer
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertbuffer);
		gl.enableVertexAttribArray(this.vertPosLoc);
		gl.vertexAttribPointer(this.vertPosLoc, 3, gl.FLOAT, false, 0, 0);
	
		// Bind texture coordinate buffer
		gl.bindBuffer(gl.ARRAY_BUFFER, this.texbuffer);
		gl.enableVertexAttribArray(this.texCoordLoc);
		gl.vertexAttribPointer(this.texCoordLoc, 2, gl.FLOAT, false, 0, 0);
	
		// Bind normal buffer
		if (this.normalBuffer) {
			gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
			gl.enableVertexAttribArray(this.normalLoc);
			gl.vertexAttribPointer(this.normalLoc, 3, gl.FLOAT, false, 0, 0);
		}
	
		gl.drawArrays(gl.TRIANGLES, 0, this.numTriangles);
	}	

	// This method is called to set the texture of the mesh.
	// The argument is an HTML IMG element containing the texture data.
	setTexture(img) {
		const texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);

		// Set the texture image data
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGB,
			gl.RGB,
			gl.UNSIGNED_BYTE,
			img);

		// Set texture parameters 
		if (isPowerOf2(img.width) && isPowerOf2(img.height)) {
			gl.generateMipmap(gl.TEXTURE_2D);
		} else {
			// Handle non-power-of-two textures
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		}

		gl.useProgram(this.prog);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		const sampler = gl.getUniformLocation(this.prog, 'tex');
		gl.uniform1i(sampler, 0);

	}

	//Task4
	setTexture2(img) {
		this.texture2 = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.texture2);
	
		// Set the texture image data
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGB,
			gl.RGB,
			gl.UNSIGNED_BYTE,
			img);
	
		// Set texture parameters
		if (isPowerOf2(img.width) && isPowerOf2(img.height)) {
			gl.generateMipmap(gl.TEXTURE_2D);
		} else {
			// Handle non-power-of-two textures
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		}
	
		this.texture2Loaded = true;
	}
	

	showTexture(show) {
		gl.useProgram(this.prog);
		gl.uniform1i(this.showTexLoc, show);
	}

	enableLighting(show) {
		// Task 2: Implement the lighting and this function
		this.lightingEnabled = show;
	}

	setAmbientLight(ambient) {
		// Task 2: Implement the lighting and this function
		this.ambientValue = ambient;
	}

	setSpecularIntensity(intensity) {
        this.specularIntensity = intensity;
    }

    setShininess(shininess) {
        this.shininess = shininess;
    }

	enableTextureBlending(enable) {
		this.blendTextures = enable;
	}
}

function SetSpecularLight(param) {
    
    const intensity = param.value / 100.0;
    meshDrawer.setSpecularIntensity(intensity);
    DrawScene();
}

function isPowerOf2(value) {
	return (value & (value - 1)) == 0;
}

function normalize(v, dst) {
	dst = dst || new Float32Array(3);
	var length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
	// make sure we don't divide by 0.
	if (length > 0.00001) {
		dst[0] = v[0] / length;
		dst[1] = v[1] / length;
		dst[2] = v[2] / length;
	}
	return dst;
}

//Task4
function LoadTexture2(param) {
    if (param.files && param.files[0]) {
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.src = e.target.result;
            img.onload = function() {
                meshDrawer.setTexture2(img);
                DrawScene();
            }
        };
        reader.readAsDataURL(param.files[0]);
    }
    DrawScene();
}

function EnableTextureBlend(param) {
    meshDrawer.enableTextureBlending(param.checked);
    DrawScene();
}


// Vertex shader source code
const meshVS = `
			attribute vec3 pos; 
			attribute vec2 texCoord; 
			attribute vec3 normal;

			uniform mat4 mvp; 

			varying vec2 v_texCoord; 
			varying vec3 v_normal; 

			void main()
			{
				v_texCoord = texCoord;
				v_normal = normal;

				gl_Position = mvp * vec4(pos,1);
			}`;

// Fragment shader source code
/**
 * @Task2 : You should update the fragment shader to handle the lighting
 */
const meshFS = `
	precision mediump float;
uniform bool showTex;
uniform bool enableLighting;
uniform sampler2D tex;
uniform vec3 color;
uniform vec3 lightPos; 
uniform float ambient;
uniform float specularIntensity;  
uniform float shininess;          

varying vec2 v_texCoord;
varying vec3 v_normal;

uniform sampler2D tex1;
uniform sampler2D tex2;
uniform bool blendTextures;

void main() {
    vec3 finalColor = color;

    if (enableLighting) {
        // Normalize the normal vector
        vec3 normal = normalize(v_normal);

        // Use lightPos as the light direction
        vec3 lightDir = normalize(lightPos);

        // Assume the view vector is (0.0, 0.0, 1.0) in view space
        vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0));

        // Ambient lighting
        vec3 ambientLight = ambient * color;

        // Diffuse lighting
        float diff = max(dot(normal, lightDir), 0.0);
        vec3 diffuseLight = diff * color;

        // Specular lighting
        vec3 reflectDir = reflect(-lightDir, normal);
        float spec = 0.0;
        if (diff > 0.0) {
            spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
        }
        vec3 specularLight = specularIntensity * spec * color;

        // Combine all lighting components
        finalColor = ambientLight + diffuseLight + specularLight;
    }

    if (showTex) {
        vec3 texColor1 = texture2D(tex1, v_texCoord).rgb;
        finalColor *= texColor1;

        if (blendTextures) {
            vec3 texColor2 = texture2D(tex2, v_texCoord).rgb;
            // Blend the two textures (simple averaging)
            finalColor = mix(finalColor, finalColor * texColor2, 0.5);
            // Alternatively, use different blending modes as desired
        }
    }

    gl_FragColor = vec4(finalColor, 1.0);
}`;

var lightX = 0.0;
var lightY = 0.0;
var lightZ = 1.0; 
const keys = {};
window.addEventListener('keydown', function(event) {
    keys[event.key] = true;
    DrawScene();
});

window.addEventListener('keyup', function(event) {
    keys[event.key] = false;
    DrawScene();
});
function updateLightPos() {
    const translationSpeed = 0.1;
    if (keys['ArrowUp']) lightY += translationSpeed;
    if (keys['ArrowDown']) lightY -= translationSpeed;
    if (keys['ArrowRight']) lightX += translationSpeed;
    if (keys['ArrowLeft']) lightX -= translationSpeed;

    // Normalize the light direction
    var length = Math.sqrt(lightX * lightX + lightY * lightY + lightZ * lightZ);
    if (length > 0.00001) {
        lightX /= length;
        lightY /= length;
        lightZ /= length;
    }
}
///////////////////////////////////////////////////////////////////////////////////