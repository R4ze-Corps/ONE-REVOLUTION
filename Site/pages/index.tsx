import Head from "next/head";

export default function Home() {
  return (
    <>
      <Head>
        <title>ONE NETWORK</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
      </Head>
      <main className="h-screen w-screen overflow-hidden bg-black">
        <iframe
          src="/design.html"
          title="ONE NETWORK"
          className="h-full w-full border-0"
        />
      </main>
    </>
  );
}
