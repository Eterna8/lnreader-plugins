import { Plugin } from '@/types/plugin';
import BelleRepository from '@plugins/english/BelleRepository';
import ReadHive from '@plugins/english/ReadHive';

const plugins: Plugin.PluginBase[] = [BelleRepository, ReadHive];

export default plugins;
