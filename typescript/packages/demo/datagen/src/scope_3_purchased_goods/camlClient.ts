import {SageMakerRuntimeClient, InvokeEndpointCommand, InvokeEndpointCommandInput} from "@aws-sdk/client-sagemaker-runtime";

export interface NAICSMatch {
    title:string;
    naicsCode:string;
    beaCode:string;
    confidence: number;
    co2ePerDollar: number;
}

export class CamlClient {
    private sagemaker: SageMakerRuntimeClient;

    private region: string = "us-west-2";
    private endpointName:string = "sif-staging-caml-endpoint";
 
    public constructor() {
        this.sagemaker = new SageMakerRuntimeClient({region: this.region});
    }

    public async matchNAICS(productName:string) : Promise<NAICSMatch[]> {        
        const input: InvokeEndpointCommandInput = { 
            EndpointName: this.endpointName,
            ContentType: "application/json",
            Body: `{"inputs": "${productName}"}`,
          };
        //   console.log(`input: ${JSON.stringify(input)}`);

          const command = new InvokeEndpointCommand(input);
          const response = await this.sagemaker.send(command);
          const responseBody = new TextDecoder().decode(response.Body);
        //   console.log(`responseBody: ${responseBody}`);
          return JSON.parse(responseBody) as NAICSMatch[];
    }
    
}