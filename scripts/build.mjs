import * as esbuild from 'esbuild'
import path from 'node:path'
import fs from 'node:fs'

const prod = process.argv.includes("--prod");

const outdir = 'dist';
const opts = {
    entryPoints: ['src/index.ts'],
    entryNames: '[name]-[hash]',
    minify: prod,
    bundle: true,
    sourcemap: true,
    metafile: true,
    target: ['chrome58', 'firefox57', 'safari11', 'edge18'],
    outdir: outdir,
    plugins: [{
        name: 'bundleHTML',
        setup(build) {
            build.onEnd(async result => {
                let html = new String(await fs.promises.readFile('src/index.html'));
                for (const [distFile, info] of Object.entries(result.metafile.outputs)) {
                    // Find the output corresponding to the JS entry point
                    if (!info.entryPoint) {
                        continue;
                    }

                    // Fill in entry points
                    html = html.replace("{{JSENTRY}}", path.relative(build.initialOptions.outdir, distFile));
                    html = html.replace("{{CSSENTRY}}", path.relative(build.initialOptions.outdir, info.cssBundle));
                }
                fs.promises.writeFile(
                    path.join(build.initialOptions.outdir, 'index.html'),
                    html,
                );
            });
        },
    }],
};

if (process.argv.includes("--serve")) {
    const ctx = await esbuild.context(opts);
    const { port } = await ctx.serve({
        servedir: outdir,
    });
    console.log(`Serving on port ${port}`);
} else {
    await esbuild.build(opts);
}
