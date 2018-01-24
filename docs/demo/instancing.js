import {
    Device,
    Command,
    AttributeData,
    VertexBuffer,
} from "./lib/glutenfree.es.js";

const dev = Device.mount();
const [width, height] = [dev.canvasCSSWidth, dev.canvasCSSHeight];

const view = mat4.identity(mat4.create());

const cmd = Command.create(
    dev,
    `#version 300 es
        precision mediump float;

        uniform mat4 u_projection;
        uniform mat4 u_model;
        uniform mat4 u_view;

        layout (location = 0) in vec2 a_position;
        layout (location = 1) in vec4 a_color;
        layout (location = 2) in vec2 a_offset;

        out vec4 v_vertex_color;

        void main() {
            v_vertex_color = a_color;
            gl_Position = u_projection
                * u_view
                * u_model
                * vec4(a_position + a_offset, 0.0, 1.0);
        }
    `,
    `#version 300 es
        precision mediump float;

        in vec4 v_vertex_color;

        out vec4 f_color;

        void main() {
            f_color = v_vertex_color;
        }
    `,
    {
        uniforms: {
            u_projection: {
                type: "matrix4fv",
                value: mat4.ortho(
                    mat4.create(),
                    -width / 2,
                    width / 2,
                    -height / 2,
                    height / 2,
                    -0.1,
                    1000.0,
                ),
            },
            u_model: {
                type: "matrix4fv",
                value: mat4.fromScaling(mat4.create(), [50, 50, 100]),
            },
            u_view: {
                type: "matrix4fv",
                value: () => mat4.rotateZ(view, view, 0.01),
            },
        },
    },
);

const attrs = AttributeData.fromElements(
    dev,
    [
        [0, 3, 2],
        [1, 3, 0],
    ],
    cmd.locate({
        a_position: [
            [1, 1],
            [-1, 1],
            [1, -1],
            [-1, -1],
        ],
        a_offset: {
            type: "pointer",
            buffer: VertexBuffer.fromFloat32Array(dev, [
                3, 3,
                0, 3,
                3, 0,
                -3, -3,
                0, -3,
                -3, 0,
                0, 0,
            ]),
            count: 7,
            size: 2,
            divisor: 1,
        },
        a_color: {
            type: "pointer",
            buffer: VertexBuffer.fromUint8Array(dev, [
                255, 0, 0, 255,
                0, 255, 0, 255,
                0, 0, 255, 255,
                0, 255, 255, 255,
                255, 0, 255, 255,
                255, 255, 0, 255,
                255, 255, 255, 255,
            ]),
            count: 7,
            size: 4,
            normalized: true,
            divisor: 1,
        },
    }),
);

const loop = () => {
    dev.target(rt => {
        rt.clearColor(0, 0, 0, 1);
        rt.draw(cmd, attrs);
    });
    window.requestAnimationFrame(loop);
}

window.requestAnimationFrame(loop);