import * as assert from "./util/assert";
import { BufferBits, Filter, Primitive } from "./types";

export type Device = import ("./device").Device;
export type Command<P> = import ("./command").Command<P>;
export type UniformDescriptor<P> = import ("./command").UniformDescriptor<P>;
export type TextureAccessor<P> = import ("./command").TextureAccessor<P>;
export type Attributes = import ("./attributes").Attributes;
export type Framebuffer = import ("./framebuffer").Framebuffer;

export interface TargetClearOptions {
    r?: number;
    g?: number;
    b?: number;
    a?: number;
    depth?: number;
    stencil?: number;
    scissorX?: number;
    scissorY?: number;
    scissorWidth?: number;
    scissorHeight?: number;
}

export type BlitFilter = Filter.NEAREST | Filter.LINEAR;
export interface TargetBlitOptions {
    srcX?: number;
    srcY?: number;
    srcWidth?: number;
    srcHeight?: number;
    dstX?: number;
    dstY?: number;
    dstWidth?: number;
    dstHeight?: number;
    filter?: BlitFilter;
    scissorX?: number;
    scissorY?: number;
    scissorWidth?: number;
    scissorHeight?: number;
}

export interface TargetDrawOptions {
    viewportX?: number;
    viewportY?: number;
    viewportWidth?: number;
    viewportHeight?: number;
    scissorX?: number;
    scissorY?: number;
    scissorWidth?: number;
    scissorHeight?: number;
}

/**
 * Target represents a drawable surface. Get hold of targets with
 * `device.target()` or `framebuffer.target()`.
 */
export class Target {

    constructor(
        private dev: Device,
        private glDrawBuffers: number[],
        private glFramebuffer: WebGLFramebuffer | null,
        private surfaceWidth?: number,
        private surfaceHeight?: number,
    ) { }

    /**
     * Run the callback with the target bound. This is called automatically,
     * when obtaining a target via `device.target()` or `framebuffer.target()`.
     *
     * All drawing to the target should be done within the callback to prevent
     * unnecessary rebinding.
     */
    with(cb: (rt: Target) => void): void {
        const {
            dev: {
                _stackDrawBuffers,
                _stackDrawFramebuffer,
            },
            glFramebuffer,
            glDrawBuffers,
        } = this;

        _stackDrawFramebuffer.push(glFramebuffer);
        _stackDrawBuffers.push(glDrawBuffers);

        cb(this);

        _stackDrawFramebuffer.pop();
        _stackDrawBuffers.pop();
    }

    /**
     * Clear selected buffers to provided values.
     */
    clear(
        bits: BufferBits,
        {
            r = 0,
            g = 0,
            b = 0,
            a = 1,
            depth = 1,
            stencil = 0,
            scissorX = 0,
            scissorY = 0,
            scissorWidth = this.surfaceWidth === void 0
                ? this.dev._gl.drawingBufferWidth
                : this.surfaceWidth,
            scissorHeight = this.surfaceHeight === void 0
                ? this.dev._gl.drawingBufferHeight
                : this.surfaceHeight,
        }: TargetClearOptions = {},
    ): void {
        this.with(() => {
            const gl = this.dev._gl;

            gl.scissor(scissorX, scissorY, scissorWidth, scissorHeight);

            if (bits & BufferBits.COLOR) { gl.clearColor(r, g, b, a); }
            if (bits & BufferBits.DEPTH) { gl.clearDepth(depth); }
            if (bits & BufferBits.STENCIL) { gl.clearStencil(stencil); }
            gl.clear(bits);
        });
    }


    /**
     * Blit source framebuffer onto this render target. Use buffer bits to
     * choose buffers to blit.
     */
    blit(
        source: Framebuffer,
        bits: BufferBits,
        {
            srcX = 0,
            srcY = 0,
            srcWidth = source.width,
            srcHeight = source.height,
            dstX = 0,
            dstY = 0,
            dstWidth = this.surfaceWidth === void 0
                ? this.dev._gl.drawingBufferWidth
                : this.surfaceWidth,
            dstHeight = this.surfaceHeight === void 0
                ? this.dev._gl.drawingBufferHeight
                : this.surfaceHeight,
            filter = Filter.NEAREST,
            scissorX = dstX,
            scissorY = dstY,
            scissorWidth = dstWidth,
            scissorHeight = dstHeight,
        }: TargetBlitOptions = {},
    ): void {
        const { dev: { _gl: gl } } = this;

        this.with(() => {
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, source.glFramebuffer);
            gl.scissor(scissorX, scissorY, scissorWidth, scissorHeight);
            gl.blitFramebuffer(
                srcX,
                srcY,
                srcWidth,
                srcHeight,
                dstX,
                dstY,
                dstWidth,
                dstHeight,
                bits,
                filter,
            );
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        });
    }

    /**
     * Draw to this target with a void command and attributes.
     */
    draw(cmd: Command<void> | Command<undefined>, attrs: Attributes): void;
    /**
     * Draw to this target with a command, attributes, and command properties.
     * The properties are passed to the command's uniform or texture callbacks,
     * if used.
     */
    draw<P>(
        cmd: Command<P>,
        attrs: Attributes,
        props: P,
        opts?: TargetDrawOptions,
    ): void;
    /**
     * Draw to this target with a command, attributes, and command properties.
     * The properties are passed to the command's uniform or texture callbacks,
     * if used.
     *
     * This is a unified header to stisfy the typechecker.
     */
    draw(
        cmd: Command<any>,
        attrs: Attributes,
        props?: any,
        {
            viewportX = 0,
            viewportY = 0,
            viewportWidth = this.surfaceWidth === void 0
                ? this.dev._gl.drawingBufferWidth
                : this.surfaceWidth,
            viewportHeight = this.surfaceHeight === void 0
                ? this.dev._gl.drawingBufferHeight
                : this.surfaceHeight,
            scissorX = viewportX,
            scissorY = viewportY,
            scissorWidth = viewportWidth,
            scissorHeight = viewportHeight,
        }: TargetDrawOptions = {},
    ): void {
        const {
            dev: {
                _gl: gl,
                _stackVertexArray,
                _stackProgram,
                _stackDepthTest,
                _stackStencilTest,
                _stackBlend,
            },
        } = this;
        const {
            glProgram,
            depthDescr,
            stencilDescr,
            blendDescr,
            textureAccessors,
            uniformDescrs,
        } = cmd;

        this.with(() => {
            _stackDepthTest.push(depthDescr);
            _stackStencilTest.push(stencilDescr);
            _stackBlend.push(blendDescr);
            _stackProgram.push(glProgram);

            this.textures(textureAccessors, props, 0);
            this.uniforms(uniformDescrs, props, 0);

            // Note that attrs.glVertexArray may be null for empty attrs -> ok
            _stackVertexArray.push(attrs.glVertexArray);

            gl.viewport(viewportX, viewportY, viewportWidth, viewportHeight);
            gl.scissor(scissorX, scissorY, scissorWidth, scissorHeight);

            if (attrs.indexed) {
                this.drawElements(
                    attrs.primitive,
                    attrs.elementCount,
                    attrs.indexType!,
                    0, // offset
                    attrs.instanceCount,
                );
            } else {
                this.drawArrays(
                    attrs.primitive,
                    attrs.count,
                    0, // offset
                    attrs.instanceCount,
                );
            }

            _stackVertexArray.pop();

            _stackBlend.pop();
            _stackStencilTest.pop();
            _stackDepthTest.pop();
            _stackProgram.pop();
        });
    }

    /**
     * Perform multiple draws to this target with the same command, but multiple
     * attributes and command properties. The properties are passed to the
     * command's uniform or texture callbacks, if used.
     *
     * All drawing should be performed within the callback to prevent
     * unnecesasry rebinding.
     */
    batch<P>(
        cmd: Command<P>,
        cb: (draw: (attrs: Attributes, props: P) => void) => void,
        {
            viewportX = 0,
            viewportY = 0,
            viewportWidth = this.surfaceWidth === void 0
                ? this.dev._gl.drawingBufferWidth
                : this.surfaceWidth,
            viewportHeight = this.surfaceHeight === void 0
                ? this.dev._gl.drawingBufferHeight
                : this.surfaceHeight,
            scissorX = viewportX,
            scissorY = viewportY,
            scissorWidth = viewportWidth,
            scissorHeight = viewportHeight,
        }: TargetDrawOptions = {},
    ): void {
        const {
            dev: {
                _gl: gl,
                _stackVertexArray,
                _stackProgram,
                _stackDepthTest,
                _stackStencilTest,
                _stackBlend,
            },
        } = this;
        const {
            glProgram,
            depthDescr,
            stencilDescr,
            blendDescr,
            textureAccessors,
            uniformDescrs,
        } = cmd;

        // The price for gl.useProgram, enabling depth/stencil tests and
        // blending is paid only once for all draw calls in batch, unless API
        // is badly abused and the draw() callback is called outside ot batch()

        // Perform shared batch setup

        _stackDepthTest.push(depthDescr);
        _stackStencilTest.push(stencilDescr);
        _stackBlend.push(blendDescr);
        _stackProgram.push(glProgram);

        let i = 0;

        cb((attrs: Attributes, props: P) => {
            // with() ensures the original target is still bound
            this.with(() => {
                i++;

                // Ensure the shared setup still holds

                _stackDepthTest.push(depthDescr);
                _stackStencilTest.push(stencilDescr);
                _stackBlend.push(blendDescr);
                _stackProgram.push(glProgram);

                this.textures(textureAccessors, props, i);
                this.uniforms(uniformDescrs, props, i);

                _stackVertexArray.push(attrs.glVertexArray);

                gl.viewport(viewportX, viewportY, viewportWidth, viewportHeight);
                gl.scissor(scissorX, scissorY, scissorWidth, scissorHeight);

                if (attrs.indexed) {
                    this.drawElements(
                        attrs.primitive,
                        attrs.elementCount,
                        attrs.indexType!,
                        0, // offset
                        attrs.instanceCount,
                    );
                } else {
                    this.drawArrays(
                        attrs.primitive,
                        attrs.count,
                        0, // offset
                        attrs.instanceCount,
                    );
                }

                _stackVertexArray.pop();

                _stackProgram.pop();
                _stackBlend.pop();
                _stackStencilTest.pop();
                _stackDepthTest.pop();
            });
        });

        _stackProgram.pop();
        _stackBlend.pop();
        _stackStencilTest.pop();
        _stackDepthTest.pop();
    }

    private drawArrays(
        primitive: Primitive,
        count: number,
        offset: number,
        instanceCount: number,
    ): void {
        const gl = this.dev._gl;
        if (instanceCount) {
            gl.drawArraysInstanced(
                primitive,
                offset,
                count,
                instanceCount,
            );
        } else {
            gl.drawArrays(primitive, offset, count);
        }
    }

    private drawElements(
        primitive: Primitive,
        count: number,
        type: number,
        offset: number,
        instCount: number,
    ): void {
        const gl = this.dev._gl;
        if (instCount) {
            gl.drawElementsInstanced(
                primitive,
                count,
                type,
                offset,
                instCount,
            );
        } else {
            gl.drawElements(
                primitive,
                count,
                type,
                offset,
            );
        }
    }

    private textures<P>(
        textureAccessors: TextureAccessor<P>[],
        props: P,
        index: number,
    ): void {
        const gl = this.dev._gl;
        textureAccessors.forEach((accessor, i) => {
            const tex = access(props, index, accessor);
            gl.activeTexture(gl.TEXTURE0 + i);
            gl.bindTexture(gl.TEXTURE_2D, tex.glTexture);
        });
    }

    private uniforms<P>(
        uniformDescrs: UniformDescriptor<P>[],
        props: P,
        index: number,
    ): void {
        const gl = this.dev._gl;
        uniformDescrs.forEach(({
            identifier: ident,
            location: loc,
            definition: def,
        }) => {
            switch (def.type) {
                case "1f":
                    gl.uniform1f(loc, access(props, index, def.value));
                    break;
                case "1fv":
                    gl.uniform1fv(loc, access(props, index, def.value));
                    break;
                case "1i":
                    gl.uniform1i(loc, access(props, index, def.value));
                    break;
                case "1iv":
                    gl.uniform1iv(loc, access(props, index, def.value));
                    break;
                case "1ui":
                    gl.uniform1ui(loc, access(props, index, def.value));
                    break;
                case "1uiv":
                    gl.uniform1uiv(loc, access(props, index, def.value));
                    break;
                case "2f": {
                    const [x, y] = access(props, index, def.value);
                    gl.uniform2f(loc, x, y);
                    break;
                }
                case "2fv":
                    gl.uniform2fv(loc, access(props, index, def.value));
                    break;
                case "2i": {
                    const [x, y] = access(props, index, def.value);
                    gl.uniform2i(loc, x, y);
                    break;
                }
                case "2iv":
                    gl.uniform2iv(loc, access(props, index, def.value));
                    break;
                case "2ui": {
                    const [x, y] = access(props, index, def.value);
                    gl.uniform2ui(loc, x, y);
                    break;
                }
                case "2uiv":
                    gl.uniform2uiv(loc, access(props, index, def.value));
                    break;
                case "3f": {
                    const [x, y, z] = access(props, index, def.value);
                    gl.uniform3f(loc, x, y, z);
                    break;
                }
                case "3fv":
                    gl.uniform3fv(loc, access(props, index, def.value));
                    break;
                case "3i": {
                    const [x, y, z] = access(props, index, def.value);
                    gl.uniform3i(loc, x, y, z);
                    break;
                }
                case "3iv":
                    gl.uniform3iv(loc, access(props, index, def.value));
                    break;
                case "3ui": {
                    const [x, y, z] = access(props, index, def.value);
                    gl.uniform3ui(loc, x, y, z);
                    break;
                }
                case "3uiv":
                    gl.uniform3uiv(loc, access(props, index, def.value));
                    break;
                case "4f": {
                    const [x, y, z, w] = access(props, index, def.value);
                    gl.uniform4f(loc, x, y, z, w);
                    break;
                }
                case "4fv":
                    gl.uniform4fv(loc, access(props, index, def.value));
                    break;
                case "4i": {
                    const [x, y, z, w] = access(props, index, def.value);
                    gl.uniform4i(loc, x, y, z, w);
                    break;
                }
                case "4iv":
                    gl.uniform4iv(loc, access(props, index, def.value));
                    break;
                case "4ui": {
                    const [x, y, z, w] = access(props, index, def.value);
                    gl.uniform4ui(loc, x, y, z, w);
                    break;
                }
                case "4uiv":
                    gl.uniform4uiv(loc, access(props, index, def.value));
                    break;
                case "matrix2fv":
                    gl.uniformMatrix2fv(
                        loc,
                        false,
                        access(props, index, def.value),
                    );
                    break;
                case "matrix3fv":
                    gl.uniformMatrix3fv(
                        loc,
                        false,
                        access(props, index, def.value),
                    );
                    break;
                case "matrix4fv":
                    gl.uniformMatrix4fv(
                        loc,
                        false,
                        access(props, index, def.value),
                    );
                    break;
                default:
                    assert.unreachable(def, () => `Unknown uniform: ${ident}`);
                    break;
            }
        });
    }
}

function access<P, R>(
    props: P,
    index: number,
    value: ((props: P, index: number) => R) | R,
): R { return typeof value === "function" ? value(props, index) : value; }
