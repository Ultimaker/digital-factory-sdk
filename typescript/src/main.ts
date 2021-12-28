import { DigitalFactoryDemo } from './digital-factory';
import { prettyJSON, print } from './print';

async function main(): Promise<void> {
    const demo = new DigitalFactoryDemo();
    await demo.signIn();
    print('Sign in completed.\n');

    print('Creating demo project...');
    const { library_project_id } = await demo.createProject('Demo project');
    print(`Created project with ID: ${library_project_id}\n`);

    print('Adding comment to demo project...');
    await demo.addCommentToProject(library_project_id, 'Demo comment');
    print('Comment added.\n');

    const clusterId = process.env.CLUSTER_ID;
    const ufpPath = process.env.UFP_PATH;
    if (clusterId !== 'your-cluster-id' && ufpPath !== 'path/to/your/file.ufp') {
        print('Uploading file to demo project...');
        const { job_id } = await demo.uploadFileToProject(library_project_id, ufpPath);
        print(`Uploaded file with ID: ${job_id}\n`);
        print(`Visit https://digitalfactory.ultimaker.com/app/library/project/${library_project_id} to see your project\n`);

        print('Submitting a print job');
        const { job_instance_uuid } = await demo.submitPrintJob(job_id, clusterId);
        print(`Submitted print job with ID: ${job_instance_uuid}\n`);
    } else {
        print('(Skipping print job submission. Configure a cluster ID and UFP in \'config.env\' for this part of the demo.)');
    }

    print('Getting running print jobs.');
    const printJobs = await demo.getRunningPrintJobs();
    if (printJobs.length > 0) {
        print(`Total print jobs retrieved: ${printJobs.length}`);
        print(`First print job retrieved: ${prettyJSON(printJobs[0])}\n`);
    } else {
        print('No running print jobs found. Sometimes it takes up to 10 second for new print jobs to show up.\n');
    }

    print('Searching projects.');
    const projects = await demo.searchProjects();
    if (projects.length > 0) {
        print(`Total projects retrieved: ${projects.length}`);
        print(`First project retrieved: ${prettyJSON(projects[0])}\n`);
    } else {
        print('No projects found.\n');
    }
}

main()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
        console.error(error); // eslint-disable-line no-console
        process.exit(1);
    });
