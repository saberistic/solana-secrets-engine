import {
  Connection,
  Transaction,
  sendAndConfirmRawTransaction,
} from "@solana/web3.js";


describe("make a transaction", () => {

  const solConn = new Connection("https://api.devnet.solana.com", "confirmed");

  it("should submit transaction", async () => {
    const serializedTx =
      "Aqm4bBLBUT7ZOFlqRGUl5/NXRvVLw4L/J0MBoPdkQQecZgZVzHFNkVUcdKJ3tWiTsRXHwX5AxOgKP921TK/gNAC43WNhls94QPcGCvh0Q+KcWZnFYv6lfMLvv93DjJt7dnWfvypBdF+Brbc+aZyDBrvRbH8Q562Bhs2xsCASQIQFAgECBrepxFZ08MC60cOcsoC1eEJ6BWvor5F+R42MifyItJGINCBR4JZvkL1taWv1dMoN7zHebVD+/Q6kwK/sEZhtg9EazEMbaBWVfibTfx2WztNsLvMh/BhZoTT/CdWM17ovjXN065Fwl7rUh0k3gsZie0S7W6BiAEIVY6i7mVFSYpLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGp9UXGSxWjuCKhF9z0peIzwNcMUWyGrNE2AYuqUAAACKrLj1fXNDQS3oDAFvAPbWHsy8id6TpnVGIeSbMSrJlAgQDAwUBBAQAAAAEAgACDAIAAACAlpgAAAAAAA==";
    const tx = Transaction.from(Buffer.from(serializedTx, "base64"));
    const sz = tx.serialize({
      requireAllSignatures: true,
      verifySignatures: true,
    });
    const sig = await sendAndConfirmRawTransaction(solConn, sz, {
      commitment: "confirmed",
    });
    console.log(sig);
  });
});
