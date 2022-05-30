import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { Contract, providers, utils } from "ethers"
import Head from "next/head"
import React from "react"
import Button from "@mui/material/Button"
import TextField from "@mui/material/TextField"
import { FormContainer, TextFieldElement } from "react-hook-form-mui"
import { useFormik } from "formik"
import * as yup from 'yup'
import styles from "../styles/Home.module.css"
import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json"

export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")

    async function listenNewGreeting() {
        console.log("listening...")
        const provider = new providers.JsonRpcProvider("http://localhost:8545")
        
        const contract = new Contract("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", Greeter.abi, provider)
        contract.on("NewGreeting", (greeting: string) => {
            console.log(utils.parseBytes32String(greeting));
            setLogs(utils.parseBytes32String(greeting));
        })
        console.log("listened")
    }

    async function greet() {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        const greeting = "Hello world"

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        setLogs("Creating your Semaphore proof...")

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }

    }

    // Form validation schema by yup 
    const formData = yup.object({
        name: yup.string().required("Name is required field"),
        age: yup.number().required("Age is required field"),
        address: yup.string().required("Address is required field")
    });


    const formik = useFormik({
        initialValues: {
          name: 'testName',
          age: 0,
          address: 'testAdress',
        },
        validationSchema: formData,
        onSubmit: (values) => {
          console.log(values);
        },
    })

    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>

                <div onClick={() => greet()} className={styles.button}>
                    Greet
                </div>
                {/* Button for listening NewGreeting */}
                <div onClick={() => listenNewGreeting()} className={styles.button}>
                    Listen NewGreeting
                </div>
            </main>

            {/* // Form for logging name, age, address */}
            <form onSubmit={formik.handleSubmit}>
                <TextField name={"name"} value={formik.values.name} onChange={formik.handleChange} label={"Name"} margin={"dense"} required /> <br />
                <TextField name={"age"} value={formik.values.age} onChange={formik.handleChange} label={"Age"} margin={"dense"} required type={"number"} /> <br />
                <TextField name={"address"} value={formik.values.address} required onChange={formik.handleChange} margin={"dense"} label={"Address"} /> <br />
                <Button type={"submit"} variant={"outlined"} color={"primary"}>Submit</Button>
            </form>
        </div>

    )
}