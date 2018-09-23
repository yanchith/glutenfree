import { BufferBits, Filter } from "./types";
export declare type Device = import("./device").Device;
export declare type Command<P> = import("./command").Command<P>;
export declare type DepthTestDescriptor = import("./command").DepthTestDescriptor;
export declare type StencilTestDescriptor = import("./command").StencilTestDescriptor;
export declare type BlendDescriptor = import("./command").BlendDescriptor;
export declare type UniformDescriptor<P> = import("./command").UniformDescriptor<P>;
export declare type TextureAccessor<P> = import("./command").TextureAccessor<P>;
export declare type Attributes = import("./attributes").Attributes;
export declare type Framebuffer = import("./framebuffer").Framebuffer;
/**
 * Tracks binding of `Target`s for each `Device`. Each `Device` must have at most
 * one `Target` bound at any time. Nested target binding is not supported even
 * though it is not prohibited by the shape of the API:
 *
 * // This produces a runtime error
 * fbo.target((fbort) => {
 *     dev.target((rt) => rt.draw(...));
 *     fbort.draw(...);
 * });
 *
 * WeakSet is used instead of `private static` variables, as there can be
 * multiple `Device`s owning the targets.
 */
export declare const TARGET_BINDINGS: WeakSet<import("./device").Device>;
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
export declare type BlitFilter = Filter.NEAREST | Filter.LINEAR;
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
export declare class Target {
    private dev;
    private glDrawBuffers;
    private glFramebuffer;
    private surfaceWidth?;
    private surfaceHeight?;
    constructor(dev: Device, glDrawBuffers: number[], glFramebuffer: WebGLFramebuffer | null, surfaceWidth?: number | undefined, surfaceHeight?: number | undefined);
    /**
     * Run the callback with the target bound. This is called automatically,
     * when obtaining a target via `device.target()` or `framebuffer.target()`.
     *
     * All writes/drawing to the target MUST be done within the callback.
     */
    with(cb: (rt: Target) => void): void;
    /**
     * Clear selected buffers to provided values.
     */
    clear(bits: BufferBits, { r, g, b, a, depth, stencil, scissorX, scissorY, scissorWidth, scissorHeight, }?: TargetClearOptions): void;
    /**
     * Blit source framebuffer onto this render target. Use buffer bits to
     * choose buffers to blit.
     */
    blit(source: Framebuffer, bits: BufferBits, { srcX, srcY, srcWidth, srcHeight, dstX, dstY, dstWidth, dstHeight, filter, scissorX, scissorY, scissorWidth, scissorHeight, }?: TargetBlitOptions): void;
    /**
     * Draw to this target with a void command and attributes.
     */
    draw(cmd: Command<void> | Command<undefined>, attrs: Attributes): void;
    /**
     * Draw to this target with a command, attributes, and command properties.
     * The properties are passed to the command's uniform or texture callbacks,
     * if used.
     */
    draw<P>(cmd: Command<P>, attrs: Attributes, props: P, opts?: TargetDrawOptions): void;
    /**
     * Perform multiple draws to this target with the same command, but multiple
     * attributes and command properties. The properties are passed to the
     * command's uniform or texture callbacks, if used.
     *
     * All drawing should be performed within the callback to prevent
     * unnecesasry rebinding.
     */
    batch<P>(cmd: Command<P>, cb: (draw: (attrs: Attributes, props: P) => void) => void, { viewportX, viewportY, viewportWidth, viewportHeight, scissorX, scissorY, scissorWidth, scissorHeight, }?: TargetDrawOptions): void;
    private drawArrays;
    private drawElements;
    private textures;
    private uniforms;
    private depthTest;
    private stencilTest;
    private blend;
}
//# sourceMappingURL=target.d.ts.map