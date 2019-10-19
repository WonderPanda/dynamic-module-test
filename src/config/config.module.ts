import { DynamicModule, Module, Provider } from '@nestjs/common';
import { CONFIG_MODULE_OPTIONS } from './config.constants';
import { createConfigProvider } from './config.provider';
import { ConfigService } from './config.service';
import {
  ConfigModuleAsyncOptions,
  ConfigModuleOptions,
  ConfigOptionsFactory,
} from './interfaces/config-options.interface';
import { Subject, interval, race } from 'rxjs';
import { take, first, map } from 'rxjs/operators';

@Module({
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {
  private static moduleSubject = new Subject<DynamicModule>();

  private static timeout$ = interval(2500).pipe(
    first(),
    map(x => {
      throw new Error(
        `Expected Config Service to be configured by at last one Module but it was not configured within 2500ms`,
      );
    }),
  );

  public static Deferred: Promise<DynamicModule> = race(
    ConfigModule.timeout$,
    ConfigModule.moduleSubject.pipe(take(1)),
  ).toPromise();

  static forRoot(options: ConfigModuleOptions): DynamicModule {
    const dynamicConfigModule = {
      module: ConfigModule,
      providers: createConfigProvider(options),
    };

    this.moduleSubject.next(dynamicConfigModule);

    return dynamicConfigModule;
  }

  static forRootAsync(options: ConfigModuleAsyncOptions): DynamicModule {
    const dynamicConfigModule = {
      module: ConfigModule,
      imports: options.imports || [],
      providers: this.createAsyncProviders(options),
    };

    this.moduleSubject.next(dynamicConfigModule);
    return dynamicConfigModule;
  }

  private static createAsyncProviders(
    options: ConfigModuleAsyncOptions,
  ): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProviders(options)];
    }
    if (options.useClass) {
      return [
        this.createAsyncOptionsProviders(options),
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
      ];
    }
    throw new Error('Invalid ConfigModule configuration.');
  }

  private static createAsyncOptionsProviders(
    options: ConfigModuleAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      return {
        provide: CONFIG_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }
    return {
      provide: CONFIG_MODULE_OPTIONS,
      useFactory: async (optionsFactory: ConfigOptionsFactory) =>
        await optionsFactory.createConfigOptions(),
      inject: [options.useExisting || options.useClass || ''],
    };
  }
}
