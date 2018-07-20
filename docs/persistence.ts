/**
 * This example demonstrates a CRT persistence postprocessing effect.
 *
 * Persistence technique inspired by the excellent talk by Gregg Tavares:
 * https://www.youtube.com/watch?v=rfQ8rKGTVlg#t=31m42s
 */

import {
    Device,
    Command,
    DepthFunc,
    Attributes,
    Texture,
    Framebuffer,
    BufferBits,
    Primitive,
    InternalFormat,
} from "./lib/webglutenfree.js";
import { mat4 } from "./libx/gl-matrix.js";

import * as bunny from "./libx/bunny.js";

const PERSISTENCE_FACTOR = 0.8;

const dev = Device.create({ antialias: false });
const [width, height] = [dev.bufferWidth, dev.bufferHeight];

const newFrameTex = Texture.create(dev, width, height, InternalFormat.RGBA8);
const depthTex = Texture.create(dev, width, height, InternalFormat.DEPTH_COMPONENT24);
const newFrameFbo = Framebuffer.create(dev, width, height, newFrameTex, depthTex);

const pingTex = Texture.create(dev, width, height, InternalFormat.RGBA8);
const pingFbo = Framebuffer.create(dev, width, height, pingTex);

const pongTex = Texture.create(dev, width, height, InternalFormat.RGBA8);
const pongFbo = Framebuffer.create(dev, width, height, pongTex);

const viewMatrix = mat4.create();

interface CmdDrawProps {
    time: number;
}

const cmdDraw = Command.create<CmdDrawProps>(
    dev,
    `#version 300 es
    precision mediump float;

    uniform mat4 u_proj, u_view;

    layout (location = 0) in vec3 a_position;
    layout (location = 1) in vec3 a_normal;

    out vec3 v_normal;

    void main() {
        mat4 matrix = u_proj * u_view;
        v_normal = transpose(inverse(mat3(matrix))) * a_normal;
        gl_Position = matrix * vec4(a_position, 1.0);
    }
    `,
    `#version 300 es
    precision mediump float;

    uniform vec3 u_light;

    in vec3 v_normal;

    out vec4 f_color;

    void main() {
        float brightness = dot(normalize(v_normal), normalize(u_light));
        vec3 dark = vec3(0.3, 0.0, 0.3);
        vec3 bright = vec3(1.0, 0.0, 0.8);
        f_color = vec4(mix(dark, bright, brightness), 1.0);
    }
    `,
    {
        uniforms: {
            u_proj: {
                type: "matrix4fv",
                value: mat4.perspective(
                    mat4.create(),
                    Math.PI / 4,
                    width / height,
                    0.1,
                    1000.0,
                ),
            },
            u_view: {
                type: "matrix4fv",
                value: ({ time }) => mat4.lookAt(
                    viewMatrix,
                    [
                        30 * Math.cos(time / 1000),
                        2.5,
                        30 * Math.sin(time / 1000),
                    ],
                    [0, 2.5, 0],
                    [0, 1, 0],
                ),
            },
            u_light: {
                type: "3f",
                value: [1, 1, 0],
            },
        },
        depth: { func: DepthFunc.LESS },
    },
);

interface CmdBlendProps {
    newFrame: Texture<InternalFormat>;
    prevFrame: Texture<InternalFormat>;
}

const cmdBlend = Command.create<CmdBlendProps>(
    dev,
    `#version 300 es
    precision mediump float;

    out vec2 v_uv;

    void main() {
        switch (gl_VertexID % 3) {
            case 0:
                gl_Position = vec4(-1, 3, 0, 1);
                v_uv = vec2(0, 2);
                break;
            case 1:
                gl_Position = vec4(-1, -1, 0, 1);
                v_uv = vec2(0, 0);
                break;
            case 2:
                gl_Position = vec4(3, -1, 0, 1);
                v_uv = vec2(2, 0);
                break;
        }
    }
    `,
    `#version 300 es
    precision mediump float;

    uniform sampler2D u_new_frame, u_prev_frame;
    uniform float u_blend_factor;

    in vec2 v_uv;

    out vec4 f_color;

    vec4 blend_alpha(vec4 src_color, vec4 dst_color, float factor) {
        return (src_color * factor) + (dst_color * (1. - factor));
    }

    void main() {
        vec4 c1 = texture(u_new_frame, v_uv);
        vec4 c2 = texture(u_prev_frame, v_uv);
        f_color = blend_alpha(c2, c1, u_blend_factor);
    }
    `,
    {
        textures: {
            u_new_frame: ({ newFrame }) => newFrame,
            u_prev_frame: ({ prevFrame }) => prevFrame,
        },
        uniforms: {
            u_blend_factor: {
                type: "1f",
                value: PERSISTENCE_FACTOR,
            },
        },
    },
);

const screenspaceAttrs = Attributes.empty(dev, Primitive.TRIANGLES, 3);
const bunnyAttrs = Attributes.create(dev, bunny.elements, cmdDraw.locate({
    a_position: bunny.positions,
    a_normal: bunny.normals,
}));


let ping = {
    tex: pingTex,
    fbo: pingFbo,
};

let pong = {
    tex: pongTex,
    fbo: pongFbo,
};

const loop = (time: number): void => {
    // By repeating the following process, we gain a buildup of past frame memory
    // in our ping/pong buffers, with an exponential falloff.

    // First draw the scene to a "newFrame" fbo
    newFrameFbo.target((rt) => {
        rt.clear(BufferBits.COLOR_DEPTH);
        rt.draw(cmdDraw, bunnyAttrs, { time });
    });

    // Then blend newFrame and ping to pong proportionate to PERSISTENCE_FACTOR
    pong.fbo.target((rt) => {
        rt.draw(
            cmdBlend,
            screenspaceAttrs,
            { newFrame: newFrameTex, prevFrame: ping.tex },
        );
    });

    // Lastly copy the contents of pong to canvas
    dev.target((rt) => {
        rt.blit(pong.fbo, BufferBits.COLOR);
    });

    // ... and swap the fbos
    const tmp = ping;
    ping = pong;
    pong = tmp;

    window.requestAnimationFrame(loop);
};

window.requestAnimationFrame(loop);
