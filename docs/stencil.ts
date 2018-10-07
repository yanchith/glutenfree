/**
 * This example utilizes stencil testing to draw simplistic outlines around
 * rendered objects. This technique only works well for convex objects, as is
 * clearly visible on the bunny and teapot models.
 */

import {
    Device,
    DepthFunc,
    StencilFunc,
    StencilOp,
    BufferBits,
} from "./lib/webglutenfree.js";
import { mat4 } from "./libx/gl-matrix.js";

import * as cube from "./libx/cube.js";
import * as bunny from "./libx/bunny.js";
import * as teapot from "./libx/teapot.js";

const dev = Device.create();
const [width, height] = [dev.bufferWidth, dev.bufferHeight];

const projMatrix = mat4.perspective(
    mat4.create(),
    Math.PI / 4,
    width / height,
    0.1,
    1000,
);

const viewMatrix = mat4.create();

interface CmdDrawProps {
    time: number;
    modelMatrix: mat4;
}

const cmdDraw = dev.createCommand<CmdDrawProps>(
    `#version 300 es
    precision mediump float;

    uniform mat4 u_proj, u_model, u_view;

    layout (location = 0) in vec3 a_position;

    out vec4 v_vertex_color;

    void main() {
        gl_Position = u_proj
            * u_view
            * u_model
            * vec4(a_position, 1.0);
    }
    `,
    `#version 300 es
    precision mediump float;

    out vec4 f_color;

    void main() {
        float depth = gl_FragCoord.z / gl_FragCoord.w;
        float factor = 1.0 - 1.0 / depth * 5.0;
        f_color = mix(
            vec4(0.2, 0.0, 0.8, 1.0),
            vec4(0.2, 0.0, 0.0, 1.0),
            factor
        );
    }
    `,
    {
        uniforms: {
            u_proj: {
                type: "matrix4fv",
                value: projMatrix,
            },
            u_view: {
                type: "matrix4fv",
                value: ({ time }) => mat4.lookAt(
                    viewMatrix,
                    [Math.sin(time / 1000) * 10, 5, Math.cos(time / 1000) * 10],
                    [0, 1, 0],
                    [0, 1, 0],
                ),
            },
            u_model: {
                type: "matrix4fv",
                value: ({ modelMatrix }) => modelMatrix,
            },
        },
        depth: { func: DepthFunc.LESS },
        stencil: {
            func: {
                func: StencilFunc.ALWAYS,
                ref: 1,
                mask: 0xFF,
            },
            mask: 0xFF,
            op: {
                fail: StencilOp.KEEP,
                zfail: StencilOp.KEEP,
                zpass: StencilOp.REPLACE,
            },
        },
    },
);

interface CmdDrawOutlinesProps {
    time: number;
    modelMatrix: mat4;
}

const cmdDrawOutlines = dev.createCommand<CmdDrawOutlinesProps>(
    `#version 300 es
        precision mediump float;

        uniform mat4 u_proj, u_model, u_view;

        layout (location = 0) in vec3 a_position;

        out vec4 v_vertex_color;

        void main() {
            gl_Position = u_proj
                * u_view
                * u_model
                * vec4(a_position, 1.0);
        }
    `,
    `#version 300 es
        precision mediump float;

        out vec4 f_color;

        void main() {
            f_color = vec4(0.0, 1.0, 0.0, 1.0);
        }
    `,
    {
        uniforms: {
            u_proj: {
                type: "matrix4fv",
                value: projMatrix,
            },
            u_view: {
                type: "matrix4fv",
                value: ({ time }) => mat4.lookAt(
                    viewMatrix,
                    [Math.sin(time / 1000) * 10, 5, Math.cos(time / 1000) * 10],
                    [0, 1, 0],
                    [0, 1, 0],
                ),
            },
            u_model: {
                type: "matrix4fv",
                value: ({ modelMatrix }) => modelMatrix,
            },
        },
        stencil: {
            func: {
                func: StencilFunc.NOTEQUAL,
                ref: 1,
                mask: 0xFF,
            },
            mask: 0x00,
        },
    },
);

const models = [teapot, bunny, cube];

const objs = models.map((m, i) => {
    const angle = i / models.length * 2 * Math.PI;
    const scale = (i + 1) * 0.1;
    const modelMatrix = mat4.fromRotation(mat4.create(), angle, [0, 1, 0]);
    mat4.translate(modelMatrix, modelMatrix, [2, 0, 0]);
    mat4.scale(modelMatrix, modelMatrix, [scale, scale, scale]);
    return {
        modelMatrix,
        attrs: dev.createAttributes(m.elements, { 0: m.positions }),
    };
});

const outlineObjs = objs.map((obj) => ({
    modelMatrix: mat4.scale(mat4.create(), obj.modelMatrix, [1.04, 1.04, 1.04]),
    attrs: obj.attrs,
}));

const loop = (time: number): void => {
    dev.target((rt) => {
        rt.clear(BufferBits.COLOR_DEPTH_STENCIL);
        rt.batch(cmdDraw, (draw) => {
            objs.forEach(({ attrs, modelMatrix }) => {
                draw(attrs, { time, modelMatrix });
            });
        });
        rt.batch(cmdDrawOutlines, (draw) => {
            outlineObjs.forEach(({ attrs, modelMatrix }) => {
                draw(attrs, { time, modelMatrix });
            });
        });
    });
    window.requestAnimationFrame(loop);
};

window.requestAnimationFrame(loop);
