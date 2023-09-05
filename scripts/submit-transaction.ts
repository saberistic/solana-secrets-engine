import {
  Connection,
  Transaction,
  sendAndConfirmRawTransaction,
} from "@solana/web3.js";


describe("make a transaction", () => {

  const solConn = new Connection("https://api.devnet.solana.com", "confirmed");

  it("should submit transaction", async () => {
    const serializedTx =
      "Al0mxUu0B21M/9e0VttnFu2laMOd0ATse4locYR534O7O1b0jOjFO93Rld2cgUU3BrogQ94ykqWK6uHrW9q8ZQ0XcHWsEjaVuIiULFglICIMbTcmIbvdPgHcas619S90X+4Se8oUU2b23BwZl1Wym7JoVjvXJtqUe+rYpImct24DAgECBkzG5uHLQl0WXb5iFXHIFSuQZ+Dz/8O4OgjA9WfL8dILNCBR4JZvkL1taWv1dMoN7zHebVD+/Q6kwK/sEZhtg9E5jDJQglKeq5Tip5ZycPslOFqrPW0MSuoUvtoARgLaJgSZ5MJ5m/4z8Jy8it1bFHRwiBqUS/hvFU3KhosvxZ4bAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGp9UXGSxWjuCKhF9z0peIzwNcMUWyGrNE2AYuqUAAAC9ze6vxVZ+rlrKzqr4vEo9A76QHysEMOr+pdgriQmVHAgQDAgUBBAQAAAAEAgADDAIAAACghgEAAAAAAA==";
    const tx = Transaction.from(Buffer.from(serializedTx, "base64"));
    const sz = tx.serialize({
      requireAllSignatures: true,
      verifySignatures: true,
    });
    const sig = await sendAndConfirmRawTransaction(solConn, sz, {
      commitment: "confirmed",
      skipPreflight: true,
    });
    console.log(sig);
  });
});
